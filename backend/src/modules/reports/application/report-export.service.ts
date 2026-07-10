import { Injectable } from '@nestjs/common';
import { PurchaseCategory } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import { NotFoundError } from '../../../shared/domain/domain-error';
import { PrismaService } from '../../../shared/infrastructure/database/prisma.service';
import {
  ADULT_WEIGHT,
  CHILD_WEIGHT,
} from '../../settlement/domain/expense-sharing.strategy';
import {
  derivePaymentStatus,
  PaymentStatus,
} from '../../payments/domain/payment-status';

const CATEGORY_LABELS: Record<PurchaseCategory, string> = {
  GROCERY: 'Supermercado',
  MEAT: 'Carnes/Açougue',
  ALCOHOL: 'Bebidas alcoólicas',
  SOFT_DRINKS: 'Refrigerantes/Sucos',
  CLEANING: 'Limpeza',
  BAKERY: 'Padaria',
  ICE: 'Gelo',
  OTHER: 'Outros',
};

const STATUS_LABELS: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: 'Pendente',
  [PaymentStatus.PARTIAL]: 'Parcial',
  [PaymentStatus.PAID]: 'Pago',
};

interface PurchaseRow {
  date: Date;
  description: string | null;
  category: string;
  buyer: string;
  chaletName: string | null;
  amountCents: number;
}

interface ChaletShareRow {
  chaletName: string;
  adults: number;
  children: number;
  alcoholConsumers: number;
  nights: number;
  commonCents: number;
  alcoholCents: number;
  totalCents: number;
  advanceCents: number;
  paidCents: number;
  balanceCents: number;
  status: PaymentStatus;
}

interface EventExportData {
  eventName: string;
  startDate: Date;
  endDate: Date;
  status: string;
  purchases: PurchaseRow[];
  purchasesTotalCents: number;
  commonTotalCents: number;
  alcoholTotalCents: number;
  guestWeight: number;
  totalAlcoholConsumers: number;
  commonPerWeightCents: number;
  alcoholPerConsumerCents: number;
  shares: ChaletShareRow[];
  hasSettlement: boolean;
}

export interface ExportFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

const DATE_FMT = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });

function formatDate(date: Date): string {
  return DATE_FMT.format(date);
}

function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const centavos = (abs % 100).toString().padStart(2, '0');
  return `${sign}R$ ${reais},${centavos}`;
}

function toReais(cents: number): number {
  return cents / 100;
}

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function formatDateForFilename(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDate().toString().padStart(2, '0');
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = d.getUTCFullYear();
  const hours = d.getUTCHours().toString().padStart(2, '0');
  const minutes = d.getUTCMinutes().toString().padStart(2, '0');
  return `${day}-${month}-${year}-${hours}h${minutes}`;
}

/**
 * Exporta o relatório consolidado de um evento (compras, consolidado e
 * rateio por chalé) em XLSX ou PDF, no mesmo formato da planilha
 * "CONSUMO FIM DE SEMANA" usada antes do sistema.
 */
@Injectable()
export class ReportExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportEventXlsx(eventId: string): Promise<ExportFile> {
    const data = await this.collectData(eventId);
    const buffer = await this.buildXlsx(data);
    return {
      buffer,
      filename: `relatorio-${slugify(data.eventName)}-${formatDateForFilename(data.startDate)}.xlsx`,
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  async exportEventPdf(eventId: string): Promise<ExportFile> {
    const data = await this.collectData(eventId);
    const buffer = await this.buildPdf(data);
    return {
      buffer,
      filename: `relatorio-${slugify(data.eventName)}-${formatDateForFilename(data.startDate)}.pdf`,
      mimeType: 'application/pdf',
    };
  }

  private async collectData(eventId: string): Promise<EventExportData> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        purchases: {
          include: { responsible: true, chalet: true },
          orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        },
        reservations: {
          where: { status: 'ACTIVE' },
          include: { chalet: true },
        },
        payments: true,
        settlement: {
          include: {
            items: {
              include: { chalet: true },
              orderBy: { chalet: { number: 'asc' } },
            },
          },
        },
      },
    });
    if (!event) {
      throw new NotFoundError('Evento não encontrado.');
    }

    const purchases: PurchaseRow[] = event.purchases.map((p) => ({
      date: p.date,
      description: p.description,
      category: CATEGORY_LABELS[p.category],
      buyer: p.responsible.name,
      chaletName: p.chalet?.name ?? null,
      amountCents: p.amountCents,
    }));
    const purchasesTotalCents = purchases.reduce(
      (sum, p) => sum + p.amountCents,
      0,
    );
    const alcoholTotalCents = event.purchases
      .filter((p) => p.category === PurchaseCategory.ALCOHOL)
      .reduce((sum, p) => sum + p.amountCents, 0);
    const commonTotalCents = purchasesTotalCents - alcoholTotalCents;

    const reservationByChalet = new Map(
      event.reservations.map((r) => [r.chaletId, r]),
    );
    const paidByChalet = new Map<string, number>();
    for (const payment of event.payments) {
      paidByChalet.set(
        payment.chaletId,
        (paidByChalet.get(payment.chaletId) ?? 0) + payment.amountCents,
      );
    }
    const advanceByChalet = new Map<string, number>();
    for (const purchase of event.purchases) {
      if (purchase.chaletId) {
        advanceByChalet.set(
          purchase.chaletId,
          (advanceByChalet.get(purchase.chaletId) ?? 0) + purchase.amountCents,
        );
      }
    }

    // Pesos em base 10 (adulto 1.0, criança 0.5), como no rateio oficial.
    const guestWeight = event.reservations.reduce(
      (sum, r) => sum + r.adults * ADULT_WEIGHT + r.children * CHILD_WEIGHT,
      0,
    );
    const totalAlcoholConsumers = event.reservations.reduce(
      (sum, r) => sum + r.alcoholConsumers,
      0,
    );

    const shares: ChaletShareRow[] = (event.settlement?.items ?? []).map(
      (item) => {
        const reservation = reservationByChalet.get(item.chaletId);
        const nights = reservation
          ? Math.max(
              0,
              Math.round(
                (reservation.checkOut.getTime() -
                  reservation.checkIn.getTime()) /
                  86_400_000,
              ),
            )
          : 0;
        const paidCents = paidByChalet.get(item.chaletId) ?? 0;
        const advanceCents = advanceByChalet.get(item.chaletId) ?? 0;
        return {
          chaletName: item.chalet.name,
          adults: reservation?.adults ?? 0,
          children: reservation?.children ?? 0,
          alcoholConsumers: reservation?.alcoholConsumers ?? 0,
          nights,
          commonCents: item.commonCents,
          alcoholCents: item.alcoholCents,
          totalCents: item.totalCents,
          advanceCents,
          paidCents,
          balanceCents: paidCents + advanceCents - item.totalCents,
          status: derivePaymentStatus(
            item.totalCents,
            paidCents + advanceCents,
          ),
        };
      },
    );

    return {
      eventName: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      status: event.status === 'CLOSED' ? 'Fechado' : 'Aberto',
      purchases,
      purchasesTotalCents,
      commonTotalCents,
      alcoholTotalCents,
      guestWeight,
      totalAlcoholConsumers,
      commonPerWeightCents:
        guestWeight > 0
          ? Math.round(commonTotalCents / (guestWeight / ADULT_WEIGHT))
          : 0,
      alcoholPerConsumerCents:
        totalAlcoholConsumers > 0
          ? Math.round(alcoholTotalCents / totalAlcoholConsumers)
          : 0,
      shares,
      hasSettlement: event.settlement !== null,
    };
  }

  private async buildXlsx(data: EventExportData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Oasís do Araguaia';
    const sheet = workbook.addWorksheet(data.eventName.slice(0, 31), {
      pageSetup: { orientation: 'landscape', fitToPage: true },
    });

    const MONEY_FMT = '"R$" #,##0.00';
    const HEADER_FILL: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E5F' },
    };
    const SECTION_FILL: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E2E8' },
    };

    sheet.columns = [
      { width: 12 },
      { width: 40 },
      { width: 22 },
      { width: 22 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 14 },
    ];

    const headerRow = (values: string[]): ExcelJS.Row => {
      const row = sheet.addRow(values);
      row.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = HEADER_FILL;
        cell.alignment = { horizontal: 'center' };
      });
      return row;
    };
    const sectionRow = (title: string): void => {
      sheet.addRow([]);
      const row = sheet.addRow([title]);
      sheet.mergeCells(row.number, 1, row.number, 8);
      row.getCell(1).font = { bold: true, size: 12 };
      row.getCell(1).fill = SECTION_FILL;
    };

    // Cabeçalho do evento
    const title = sheet.addRow([data.eventName.toUpperCase()]);
    sheet.mergeCells(title.number, 1, title.number, 8);
    title.getCell(1).font = { bold: true, size: 14 };
    const subtitle = sheet.addRow([
      `Período: ${formatDate(data.startDate)} a ${formatDate(data.endDate)}  •  Situação: ${data.status}`,
    ]);
    sheet.mergeCells(subtitle.number, 1, subtitle.number, 8);

    // Bloco 1 — Compras
    sectionRow('COMPRAS');
    headerRow([
      'Data',
      'Item/Descrição',
      'Comprador',
      'Categoria',
      'Adiantamento (chalé)',
      'Valor',
    ]);
    for (const p of data.purchases) {
      const row = sheet.addRow([
        formatDate(p.date),
        p.description ?? '—',
        p.buyer,
        p.category,
        p.chaletName ?? '—',
        toReais(p.amountCents),
      ]);
      row.getCell(6).numFmt = MONEY_FMT;
    }
    const purchasesTotal = sheet.addRow([
      '',
      '',
      '',
      '',
      'TOTAL',
      toReais(data.purchasesTotalCents),
    ]);
    purchasesTotal.font = { bold: true };
    purchasesTotal.getCell(6).numFmt = MONEY_FMT;

    // Bloco 2 — Consolidado
    sectionRow('CONSOLIDADO');
    const consolidated: Array<[string, number]> = [
      ['Alimentação e despesas comuns', data.commonTotalCents],
      ['Bebidas alcoólicas', data.alcoholTotalCents],
      ['TOTAL GERAL', data.purchasesTotalCents],
      ['Custo comum por pessoa (adulto)', data.commonPerWeightCents],
      ['Custo de bebida por consumidor', data.alcoholPerConsumerCents],
    ];
    for (const [label, cents] of consolidated) {
      const row = sheet.addRow([label, '', '', '', toReais(cents)]);
      row.getCell(5).numFmt = MONEY_FMT;
      if (label === 'TOTAL GERAL') row.font = { bold: true };
    }

    // Bloco 3 — Rateio por chalé
    sectionRow('RATEIO POR CHALÉ');
    if (data.hasSettlement) {
      headerRow([
        'Chalé',
        'Adultos',
        'Crianças',
        'Consomem álcool',
        'Diárias',
        'Custo comum',
        'Custo bebidas',
        'Total a pagar',
      ]);
      for (const s of data.shares) {
        const row = sheet.addRow([
          s.chaletName,
          s.adults,
          s.children,
          s.alcoholConsumers,
          s.nights,
          toReais(s.commonCents),
          toReais(s.alcoholCents),
          toReais(s.totalCents),
        ]);
        [6, 7, 8].forEach((c) => (row.getCell(c).numFmt = MONEY_FMT));
      }
      const totals = sheet.addRow([
        'TOTAL',
        data.shares.reduce((s, r) => s + r.adults, 0),
        data.shares.reduce((s, r) => s + r.children, 0),
        data.shares.reduce((s, r) => s + r.alcoholConsumers, 0),
        data.shares.reduce((s, r) => s + r.nights, 0),
        toReais(data.shares.reduce((s, r) => s + r.commonCents, 0)),
        toReais(data.shares.reduce((s, r) => s + r.alcoholCents, 0)),
        toReais(data.shares.reduce((s, r) => s + r.totalCents, 0)),
      ]);
      totals.font = { bold: true };
      [6, 7, 8].forEach((c) => (totals.getCell(c).numFmt = MONEY_FMT));
    } else {
      sheet.addRow(['Rateio ainda não calculado para este evento.']);
    }

    // Bloco 4 — Acerto por chalé (total, adiantamentos, pagamentos, saldo)
    if (data.hasSettlement) {
      sectionRow('VALOR POR CHALÉ — ACERTO');
      headerRow([
        'Chalé',
        'Total a pagar',
        'Adiantamentos',
        'Pagamentos',
        'Saldo final',
        'Situação',
      ]);
      for (const s of data.shares) {
        const row = sheet.addRow([
          s.chaletName,
          toReais(s.totalCents),
          toReais(s.advanceCents),
          toReais(s.paidCents),
          toReais(s.balanceCents),
          STATUS_LABELS[s.status],
        ]);
        [2, 3, 4, 5].forEach((c) => (row.getCell(c).numFmt = MONEY_FMT));
        if (s.balanceCents < 0) {
          row.getCell(5).font = { color: { argb: 'FFC0392B' } };
        }
      }
      const totals = sheet.addRow([
        'TOTAL GERAL',
        toReais(data.shares.reduce((s, r) => s + r.totalCents, 0)),
        toReais(data.shares.reduce((s, r) => s + r.advanceCents, 0)),
        toReais(data.shares.reduce((s, r) => s + r.paidCents, 0)),
        toReais(data.shares.reduce((s, r) => s + r.balanceCents, 0)),
        '',
      ]);
      totals.font = { bold: true };
      [2, 3, 4, 5].forEach((c) => (totals.getCell(c).numFmt = MONEY_FMT));
    }

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private buildPdf(data: EventExportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;

      const ensureSpace = (height: number): void => {
        if (doc.y + height > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
        }
      };

      const sectionTitle = (title: string): void => {
        ensureSpace(40);
        doc.moveDown(1);
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor('#1F4E5F')
          .text(title);
        doc
          .moveTo(doc.page.margins.left, doc.y + 2)
          .lineTo(doc.page.margins.left + pageWidth, doc.y + 2)
          .strokeColor('#1F4E5F')
          .stroke();
        doc.moveDown(0.5);
        doc.fillColor('#000000');
      };

      const drawTable = (
        headers: string[],
        rows: string[][],
        widths: number[],
        options: { boldLastRow?: boolean } = {},
      ): void => {
        const scale = pageWidth / widths.reduce((a, b) => a + b, 0);
        const cols = widths.map((w) => w * scale);
        const rowHeight = 18;

        const drawRow = (
          cells: string[],
          opts: { header?: boolean; bold?: boolean },
        ): void => {
          ensureSpace(rowHeight + 4);
          const y = doc.y;
          let x = doc.page.margins.left;
          if (opts.header) {
            doc.rect(x, y, pageWidth, rowHeight).fillColor('#1F4E5F').fill();
          }
          doc
            .font(opts.header || opts.bold ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(8)
            .fillColor(opts.header ? '#FFFFFF' : '#000000');
          cells.forEach((cell, i) => {
            doc.text(cell, x + 4, y + 5, {
              width: cols[i] - 8,
              height: rowHeight,
              ellipsis: true,
              align:
                i === 0
                  ? 'left'
                  : cell.startsWith('R$') ||
                      cell.startsWith('-R$') ||
                      /^\d+$/.test(cell)
                    ? 'right'
                    : 'left',
            });
            x += cols[i];
          });
          doc
            .moveTo(doc.page.margins.left, y + rowHeight)
            .lineTo(doc.page.margins.left + pageWidth, y + rowHeight)
            .strokeColor('#CCCCCC')
            .lineWidth(0.5)
            .stroke();
          doc.y = y + rowHeight;
          doc.x = doc.page.margins.left;
        };

        drawRow(headers, { header: true });
        rows.forEach((row, index) =>
          drawRow(row, {
            bold: options.boldLastRow === true && index === rows.length - 1,
          }),
        );
        doc.fillColor('#000000');
      };

      // Cabeçalho com Logo
      const logoPath = path.join(
        process.cwd(),
        'prisma',
        'assets',
        'logo-oasis-do-araguaia.jpeg',
      );
      let hasLogo = false;
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(
            logoPath,
            doc.page.width - doc.page.margins.right - 60,
            30,
            { width: 60 },
          );
          hasLogo = true;
        } catch (e) {
          // Ignorar
        }
      }

      doc.y = 35;
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .text(data.eventName.toUpperCase(), {
          width: hasLogo ? pageWidth - 70 : pageWidth,
        });
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#555555')
        .text(
          `Período: ${formatDate(data.startDate)} a ${formatDate(
            data.endDate,
          )}  •  Situação: ${data.status}`,
          {
            width: hasLogo ? pageWidth - 70 : pageWidth,
          },
        )
        .fillColor('#000000');

      // Bloco 1 — Compras
      sectionTitle('COMPRAS');
      drawTable(
        [
          'Data',
          'Item/Descrição',
          'Comprador',
          'Categoria',
          'Adiant.',
          'Valor',
        ],
        [
          ...data.purchases.map((p) => [
            formatDate(p.date),
            p.description ?? '—',
            p.buyer,
            p.category,
            p.chaletName ?? '—',
            formatMoney(p.amountCents),
          ]),
          ['', '', '', '', 'TOTAL', formatMoney(data.purchasesTotalCents)],
        ],
        [55, 150, 80, 80, 70, 65],
        { boldLastRow: true },
      );

      // Bloco 2 — Consolidado
      sectionTitle('CONSOLIDADO');
      drawTable(
        ['Descrição', 'Valor'],
        [
          ['Alimentação e despesas comuns', formatMoney(data.commonTotalCents)],
          ['Bebidas alcoólicas', formatMoney(data.alcoholTotalCents)],
          ['TOTAL GERAL', formatMoney(data.purchasesTotalCents)],
          [
            'Custo comum por pessoa (adulto)',
            formatMoney(data.commonPerWeightCents),
          ],
          [
            'Custo de bebida por consumidor',
            formatMoney(data.alcoholPerConsumerCents),
          ],
        ],
        [300, 100],
      );

      // Bloco 3 — Rateio por chalé
      sectionTitle('RATEIO POR CHALÉ');
      if (data.hasSettlement) {
        drawTable(
          [
            'Chalé',
            'Adultos',
            'Crianças',
            'Álcool',
            'Diárias',
            'Comum',
            'Bebidas',
            'Total',
          ],
          [
            ...data.shares.map((s) => [
              s.chaletName,
              String(s.adults),
              String(s.children),
              String(s.alcoholConsumers),
              String(s.nights),
              formatMoney(s.commonCents),
              formatMoney(s.alcoholCents),
              formatMoney(s.totalCents),
            ]),
            [
              'TOTAL',
              String(data.shares.reduce((s, r) => s + r.adults, 0)),
              String(data.shares.reduce((s, r) => s + r.children, 0)),
              String(data.shares.reduce((s, r) => s + r.alcoholConsumers, 0)),
              String(data.shares.reduce((s, r) => s + r.nights, 0)),
              formatMoney(data.shares.reduce((s, r) => s + r.commonCents, 0)),
              formatMoney(data.shares.reduce((s, r) => s + r.alcoholCents, 0)),
              formatMoney(data.shares.reduce((s, r) => s + r.totalCents, 0)),
            ],
          ],
          [110, 45, 48, 45, 45, 70, 70, 70],
          { boldLastRow: true },
        );
      } else {
        doc
          .font('Helvetica')
          .fontSize(9)
          .text('Rateio ainda não calculado para este evento.');
      }

      // Bloco 4 — Acerto por chalé
      if (data.hasSettlement) {
        sectionTitle('VALOR POR CHALÉ — ACERTO');
        drawTable(
          [
            'Chalé',
            'Total a pagar',
            'Adiantamentos',
            'Pagamentos',
            'Saldo final',
            'Situação',
          ],
          [
            ...data.shares.map((s) => [
              s.chaletName,
              formatMoney(s.totalCents),
              formatMoney(s.advanceCents),
              formatMoney(s.paidCents),
              formatMoney(s.balanceCents),
              STATUS_LABELS[s.status],
            ]),
            [
              'TOTAL GERAL',
              formatMoney(data.shares.reduce((s, r) => s + r.totalCents, 0)),
              formatMoney(data.shares.reduce((s, r) => s + r.advanceCents, 0)),
              formatMoney(data.shares.reduce((s, r) => s + r.paidCents, 0)),
              formatMoney(data.shares.reduce((s, r) => s + r.balanceCents, 0)),
              '',
            ],
          ],
          [100, 80, 80, 80, 80, 70],
          { boldLastRow: true },
        );
      }

      doc
        .moveDown(2)
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#888888')
        .text(
          `Gerado pelo sistema Oasís do Araguaia em ${new Intl.DateTimeFormat(
            'pt-BR',
            { dateStyle: 'short', timeStyle: 'short' },
          ).format(new Date())}`,
        );

      doc.end();
    });
  }
}
