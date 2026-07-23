# Deploy — Oaís do Araguaia

Produção em VPS única (Hostinger KVM 2, Ubuntu 24.04 LTS), Docker Compose,
Traefik na borda com TLS automático do Let's Encrypt, atrás do proxy da
Cloudflare.

- Domínio: `oasisaraguaia.com.br` (registrado no registro.br, DNS na Cloudflare)
- Aplicação: `https://oasisaraguaia.com.br`
- API: mesma origem, sob `/api` (o Traefik roteia por `PathPrefix`)
- `www` redireciona para o domínio sem www

```
Navegador → Cloudflare (proxy) → [ufw: só faixas CF] → Traefik → frontend/backend
```

## 1. Cloudflare e DNS (faça primeiro — propagação leva tempo)

O domínio é do registro.br, mas o **DNS passa a ser gerenciado na Cloudflare**.
Não crie registro A no registro.br: ele seria ignorado depois da troca de
nameservers e ainda deixaria o IP de origem no histórico público de DNS.

1. Crie a conta na Cloudflare e adicione o site `oasisaraguaia.com.br` (plano Free).
2. A Cloudflare mostra dois nameservers (algo como `xxx.ns.cloudflare.com`).
3. No painel do registro.br, em **Alterar servidores DNS**, troque de
   `a.auto.dns.br` / `b.auto.dns.br` para os dois da Cloudflare.
4. Na Cloudflare, em **DNS → Records**, crie com a **nuvem laranja ligada**
   (Proxied) — é a nuvem laranja que esconde o IP de origem:

```
Tipo   Nome   Conteúdo             Proxy
A      @      179.197.237.178      Proxied (laranja)
A      www    179.197.237.178      Proxied (laranja)
```

5. Em **SSL/TLS → Overview**, escolha **Full (strict)**.

> **Full (strict) não é opcional.** No modo *Flexible* a Cloudflare fala com a
> origem em HTTP puro: o tráfego entre a Cloudflare e sua VPS trafega sem
> criptografia, e o redirect HTTP→HTTPS do Traefik entra em laço infinito. Os
> modos *Off* e *Flexible* não devem ser usados aqui em nenhuma hipótese.

6. Em **SSL/TLS → Edge Certificates**, ligue **Always Use HTTPS**.

Verifique a troca de nameservers antes de seguir (pode levar horas):

```bash
dig +short NS oasisaraguaia.com.br     # deve responder .ns.cloudflare.com
dig +short A oasisaraguaia.com.br      # devolve IP da Cloudflare, não o da VPS
```

O `A` retornar um IP diferente do da VPS é o comportamento **correto** — é o
proxy funcionando.

### Token de API para o certificado

O Traefik valida o certificado por **DNS-01**, então precisa criar um registro
TXT temporário na zona. Em **My Profile → API Tokens → Create Token**:

- Template: *Edit zone DNS*
- Permissions: `Zone` · `DNS` · `Edit`
- Zone Resources: `Include` · `Specific zone` · `oasisaraguaia.com.br`

Guarde o token — vai em `CF_DNS_API_TOKEN` no `.env`.

> Use um token com escopo, **nunca a Global API Key**. A Global Key dá controle
> total da conta Cloudflare, não pode ser limitada por zona nem por permissão, e
> ficaria em texto puro dentro de um container.

## 2. Preparo da VPS

Como root, na primeira conexão:

```bash
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

Endureça o SSH em `/etc/ssh/sshd_config`:

```
PermitRootLogin no
PasswordAuthentication no
```

```bash
systemctl restart ssh
```

> Antes de fechar a sessão root, abra **outro** terminal e confirme que
> `ssh deploy@<IP>` funciona. Se a chave não estiver certa, desabilitar senha
> e login root te tranca para fora — restaria só o console VNC do painel.

Firewall e atualizações automáticas:

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw enable

apt install -y fail2ban unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades
```

**Não abra 80/443 para o mundo.** Quem libera essas portas é o
`scripts/cloudflare-ips.sh`, e só para as faixas da Cloudflare (passo 5).

Esconder o IP de origem só funciona se o acesso direto estiver bloqueado. Sem
isso, qualquer scanner acha a VPS pelo IP e o proxy da Cloudflare vira enfeite —
o atacante fala direto com a origem e pula DDoS, WAF e rate limit.

A porta 22 continua direta (o plano Free da Cloudflare não faz proxy de SSH).
Se seu IP residencial for estável, restrinja:

```bash
ufw delete allow 22/tcp
ufw allow proto tcp from <SEU-IP> to any port 22
```

> Com IP dinâmico isso te tranca para fora quando a operadora trocar seu IP.
> Nesse caso deixe a 22 aberta e conte com o fail2ban — mas confirme antes que
> o login por senha e o login de root estão desabilitados. O console VNC do
> painel da Hostinger é a saída de emergência se errar aqui.

> O Docker escreve direto no iptables e **passa por cima do ufw** para portas
> publicadas com `ports:`. Aqui só o Traefik publica (80/443) — exatamente as que
> o script restringe à Cloudflare. Postgres e Redis não têm `ports:`, ficam só na
> rede interna. Se um dia publicar outra porta, ela fica exposta apesar do ufw.

## 3. Docker (repositório oficial, não o do Ubuntu)

O pacote `docker-compose` do Ubuntu é o Compose v1, que **não entende
`depends_on: condition: service_healthy`** — usado no `docker-compose.prod.yml`.
Precisa ser o plugin v2:

```bash
apt install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker deploy
```

Confira (tem que ser v2.x):

```bash
docker compose version
```

### Compatibilidade da API do Docker com o Traefik

O Traefik crava a API do Docker em 1.24 e ignora `DOCKER_API_VERSION`. O Docker
Engine 29 só aceita a partir da 1.40, então o provider docker do Traefik falha
("client version 1.24 is too old") e nenhum roteador é carregado — sem roteador,
o certificado nunca é pedido. Reabilite a API antiga no daemon:

```bash
sudo mkdir -p /etc/systemd/system/docker.service.d
sudo tee /etc/systemd/system/docker.service.d/api-compat.conf > /dev/null <<'EOF'
[Service]
Environment=DOCKER_MIN_API_VERSION=1.24
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```

O socket do Docker não é exposto (só local), então reabilitar a API antiga não
abre superfície de ataque. Se um dia o Traefik passar a negociar a versão, este
override pode ser removido.

## 4. Código e configuração

```bash
sudo mkdir -p /opt/oais-do-araguaia
sudo chown deploy:deploy /opt/oais-do-araguaia
git clone https://github.com/lucasrbsouza/oais-do-araguaia.git /opt/oais-do-araguaia
cd /opt/oais-do-araguaia
cp .env.production.example .env
```

Gere os segredos e edite o `.env`:

```bash
openssl rand -base64 24   # POSTGRES_PASSWORD
openssl rand -base64 48   # JWT_SECRET
openssl rand -base64 48   # JWT_REFRESH_SECRET
chmod 600 .env
```

Pontos de atenção no `.env`:

- `POSTGRES_PASSWORD` e a senha dentro de `DATABASE_URL` precisam ser iguais.
- `JWT_SECRET` e `JWT_REFRESH_SECRET` têm mínimo de 16 caracteres — o schema Zod
  em `backend/src/shared/infrastructure/config/env.ts` rejeita e o container não sobe.
- `NEXT_PUBLIC_API_URL=https://oasisaraguaia.com.br` — **é `ARG` de build**, fica
  cravado na imagem do frontend. Mudar depois exige rebuild.
- `ACME_EMAIL` recebe os avisos de expiração do certificado.
- `CF_DNS_API_TOKEN` é o token com escopo criado no passo 1.
- `CLOUDFLARE_IPS` fica **em branco** — quem preenche é o script do passo 5.

## 5. Faixas da Cloudflare (firewall + Traefik)

O script restringe as portas 80/443 às faixas da Cloudflare e escreve
`CLOUDFLARE_IPS` no `.env`, que o Traefik usa em `forwardedHeaders.trustedIPs`
para saber de quem aceitar `X-Forwarded-For`.

O filtro **não** é feito no ufw. O Docker publica portas escrevendo iptables
direto (cadeia `DOCKER`, avaliada antes do `INPUT` onde o ufw atua), então regra
de ufw para 80/443 é ignorada — a origem continuaria alcançável pelo IP. O script
usa a cadeia `DOCKER-USER`, que o Docker avalia antes das regras dele e respeita.
Cobre IPv4 e IPv6.

Suba a stack primeiro (passo 6) para o Docker criar a cadeia `DOCKER-USER`, e só
então rode:

```bash
sudo ./scripts/cloudflare-ips.sh
sudo iptables  -L CF_FILTER -n | tail -3    # deve terminar em DROP para 80,443
sudo ip6tables -L CF_FILTER -n | tail -3
```

Confira que a origem ficou fechada — de fora da Cloudflare, direto no IP, tem
que dar timeout (o `--connect-timeout` evita travar):

```bash
curl -sS --connect-timeout 5 https://SEU_IP --resolve oasisaraguaia.com.br:443:SEU_IP -k \
  && echo "AINDA ABERTO" || echo "fechado (esperado)"
```

O script valida a resposta da Cloudflare antes de mexer no firewall: se vier
vazia ou truncada, aborta sem apagar regra nenhuma.

### Persistência (obrigatório)

Regras iptables somem no reboot, e a cadeia `DOCKER-USER` só existe depois que o
Docker sobe. O serviço systemd reaplica na ordem certa a cada boot:

```bash
sudo cp scripts/oais-cloudflare-fw.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable oais-cloudflare-fw.service
```

As faixas também mudam de tempos em tempos — agende a atualização mensal:

```cron
0 4 1 * * /opt/oais-do-araguaia/scripts/cloudflare-ips.sh >> /var/log/oais-cfips.log 2>&1
```

## 6. Subir

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

O build leva alguns minutos (`next build` chega a picar ~3 GB — folgado nos 8 GB
do KVM 2). O Traefik pede o certificado assim que os roteadores aparecem.

Acompanhe a emissão:

```bash
docker compose -f docker-compose.prod.yml logs -f traefik
docker compose -f docker-compose.prod.yml ps
```

> O Let's Encrypt limita **5 falhas por hora** no mesmo domínio. Se o token da
> Cloudflare estiver errado e você insistir, fica bloqueado por uma hora. Para
> testar o fluxo sem gastar essa cota, descomente a linha `acme.caserver`
> (staging) no `docker-compose.prod.yml`; depois comente de novo e apague o
> volume `traefik_acme` antes de emitir o certificado real — senão ele
> reaproveita o certificado de staging, que nenhum navegador aceita.

O desafio DNS-01 cria um registro TXT `_acme-challenge` na zona e apaga em
seguida. Se falhar, o erro no log do Traefik é sobre o token: confira se a
permissão é `Zone:DNS:Edit` e se a zona incluída é a certa.

## 7. Seed inicial (uma vez só)

Cria o admin e os 11 chalés. As migrations já rodam sozinhas no boot do backend
(`prisma migrate deploy` no `CMD`).

```bash
docker compose -f docker-compose.prod.yml exec backend npm run prisma:seed:prod
```

O seed é idempotente (`upsert`), mas rode uma vez e confirme. **Entre no sistema
e troque a senha do admin imediatamente** — ela está em texto puro no `.env`.

## 8. Backup

`scripts/backup.sh` gera dump do Postgres (`-Fc`) e tarball dos uploads em
`/var/backups/oais`, com retenção de 14 dias.

```bash
sudo mkdir -p /var/backups/oais
sudo chown deploy:deploy /var/backups/oais
./scripts/backup.sh          # teste manual antes de agendar
sudo crontab -u deploy -e
```

```cron
10 3 * * * /opt/oais-do-araguaia/scripts/backup.sh >> /var/log/oais-backup.log 2>&1
```

> Backup que só existe na própria VPS não é backup. O script tem um bloco
> comentado no fim para `rclone`/`scp` — configure um destino externo.

Restaurar:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U oais -d oais_araguaia --clean --if-exists < /var/backups/oais/db_<STAMP>.dump

docker compose -f docker-compose.prod.yml exec -T backend \
  tar -xzf - -C /app < /var/backups/oais/uploads_<STAMP>.tar.gz
```

## 9. Atualizar

```bash
cd /opt/oais-do-araguaia
./scripts/backup.sh
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Migrations aplicam sozinhas no boot. Se mudar `NEXT_PUBLIC_API_URL`, o rebuild do
frontend é obrigatório (`--build` já cobre).

## Arquitetura em produção

| Serviço  | Rede               | Porta no host |
|----------|--------------------|---------------|
| traefik  | `oais_web`         | 80, 443 (só faixas Cloudflare) |
| frontend | `oais_web`         | —             |
| backend  | `oais_web` + `oais_internal` | —    |
| postgres | `oais_internal`    | —             |
| redis    | `oais_internal`    | —             |

Postgres e Redis não são alcançáveis de fora. O backend fica nas duas redes: o
Traefik fala com ele pela `oais_web`, e ele fala com o banco pela `oais_internal`
— por isso o `--providers.docker.network=oais_web` na config do Traefik, senão
ele pode tentar a rede errada.

O dashboard do Traefik está **desligado**. O socket do Docker é montado no
container do Traefik: isso é o que permite a descoberta automática, mas dá a ele
controle equivalente a root sobre o host. O `:ro` do mount **não** é uma barreira
real — quem fala com o socket manda no daemon. Mitigação aqui é não expor o
dashboard e manter a imagem do Traefik atualizada; se quiser endurecer mais,
troque o mount direto por um socket-proxy com API só de leitura.

### IP real do usuário

A cadeia é `Cloudflare → Traefik → backend`, então o IP de origem do socket não
serve para nada. Ele é reconstruído em dois pontos, e os dois precisam estar
certos ou a auditoria grava IP errado:

1. **Traefik** aceita `X-Forwarded-For` só das faixas em
   `forwardedHeaders.trustedIPs` (`CLOUDFLARE_IPS`).
2. **Backend** usa `app.set('trust proxy', 2)` em `backend/src/main.ts` — dois
   saltos, Cloudflare e Traefik.

Isso alimenta o `ip` do `AuditLog` (`audit.interceptor.ts`) e o `ThrottlerGuard`
(100 req/min **por usuário**, não global). Se você mudar a topologia — tirar a
Cloudflare, pôr outro proxy na frente — **o número 2 muda junto**. Errar para
mais permite forjar o IP na auditoria; errar para menos volta a registrar o IP do
proxy.

Confira depois de subir: entre no sistema, faça uma ação auditável e veja a
coluna `ip` na tela de auditoria. Tem que ser seu IP público, não `172.x.x.x`.

## Diagnóstico rápido

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 backend
docker compose -f docker-compose.prod.yml logs --tail=100 traefik
docker stats --no-stream
```

| Sintoma | Causa provável |
|---|---|
| Certificado não emite | `CF_DNS_API_TOKEN` sem `Zone:DNS:Edit`, ou zona errada no token |
| Navegador reclama do certificado | `caserver` de staging ainda ativo |
| Erro 521/522 da Cloudflare | ufw sem as regras da Cloudflare — rode `cloudflare-ips.sh` |
| Laço infinito de redirect | SSL/TLS em *Flexible*; tem que ser **Full (strict)** |
| Backend reinicia em loop | `.env` inválido — o Zod loga qual variável falhou |
| Frontend chama `localhost:3101` | `NEXT_PUBLIC_API_URL` errado no build; rebuild |
| `/api` cai no frontend | Label `priority=100` do roteador `backend` ausente |
| CORS bloqueado | `CORS_ORIGINS` sem `https://oasisaraguaia.com.br` |
| Auditoria gravando `172.x.x.x` | `CLOUDFLARE_IPS` vazio, ou `trust proxy` fora de sincronia |
| Rate limit disparando cedo demais | mesma causa: todos os usuários caem num IP só |
