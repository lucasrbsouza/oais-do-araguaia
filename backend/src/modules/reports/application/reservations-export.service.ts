import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import { ExportFile } from './report-export.service';
import {
  ReservationsReport,
  ReservationsReportService,
} from './reservations-report.service';

const DATE_FMT = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Aberto',
  CLOSED: 'Encerrado',
  CANCELLED: 'Cancelado',
};

function formatDate(date: Date): string {
  return DATE_FMT.format(date);
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
  return `${day}-${month}-${d.getUTCFullYear()}`;
}

function periodo(checkIn: Date, checkOut: Date): string {
  return `${formatDate(checkIn)} a ${formatDate(checkOut)}`;
}

/**
 * Exporta o relatório geral de reservas — quantas pessoas ficaram em cada
 * chalé no evento — em XLSX ou PDF. Cada chalé traz suas reservas detalhadas
 * abaixo do próprio total, para conferir de onde saiu cada número.
 */
@Injectable()
export class ReservationsExportService {
  constructor(private readonly reservations: ReservationsReportService) {}

  async xlsx(eventId: string): Promise<ExportFile> {
    const data = await this.reservations.byEvent(eventId);
    return {
      buffer: await this.buildXlsx(data),
      filename: this.filename(data, 'xlsx'),
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  async pdf(eventId: string): Promise<ExportFile> {
    const data = await this.reservations.byEvent(eventId);
    return {
      buffer: await this.buildPdf(data),
      filename: this.filename(data, 'pdf'),
      mimeType: 'application/pdf',
    };
  }

  private filename(data: ReservationsReport, ext: string): string {
    const nome = slugify(data.event.name);
    const inicio = formatDateForFilename(data.event.startDate);
    return `reservas-${nome}-${inicio}.${ext}`;
  }

  private async buildXlsx(data: ReservationsReport): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Oásis do Araguaia';
    const sheet = workbook.addWorksheet('Reservas', {
      pageSetup: { orientation: 'landscape', fitToPage: true },
    });

    const HEADER_FILL: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E5F' },
    };
    const CHALET_FILL: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E2E8' },
    };

    sheet.columns = [
      { width: 26 },
      { width: 26 },
      { width: 22 },
      { width: 10 },
      { width: 10 },
      { width: 10 },
      { width: 16 },
      { width: 14 },
    ];

    const title = sheet.addRow([data.event.name.toUpperCase()]);
    sheet.mergeCells(title.number, 1, title.number, 8);
    title.getCell(1).font = { bold: true, size: 14 };

    const subtitle = sheet.addRow([
      `Período: ${periodo(data.event.startDate, data.event.endDate)}  •  Situação: ${
        STATUS_LABELS[data.event.status] ?? data.event.status
      }`,
    ]);
    sheet.mergeCells(subtitle.number, 1, subtitle.number, 8);
    sheet.addRow([]);

    const header = sheet.addRow([
      'Chalé',
      'Proprietário / Responsável',
      'Período',
      'Diárias',
      'Adultos',
      'Crianças',
      'Consomem álcool',
      'Total pessoas',
    ]);
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = HEADER_FILL;
      cell.alignment = { horizontal: 'center' };
    });

    for (const chalet of data.chalets) {
      const linha = sheet.addRow([
        `${chalet.chaletNumber} — ${chalet.chaletName}`,
        chalet.ownerName ?? 'Sem proprietário',
        chalet.reservations.length === 0 ? 'Sem reserva' : '',
        '',
        chalet.adults,
        chalet.children,
        chalet.alcoholConsumers,
        chalet.totalPeople,
      ]);
      linha.font = { bold: true };
      linha.eachCell((cell) => {
        cell.fill = CHALET_FILL;
      });

      for (const r of chalet.reservations) {
        sheet.addRow([
          '',
          r.responsibleName,
          periodo(r.checkIn, r.checkOut),
          r.nights,
          r.adults,
          r.children,
          r.alcoholConsumers,
          r.totalPeople,
        ]);
      }
    }

    sheet.addRow([]);
    const total = sheet.addRow([
      'TOTAL GERAL',
      `${data.totals.chaletsOccupied} de ${data.chalets.length} chalés ocupados`,
      `${data.totals.reservations} reserva(s)`,
      '',
      data.totals.adults,
      data.totals.children,
      data.totals.alcoholConsumers,
      data.totals.totalPeople,
    ]);
    total.font = { bold: true };

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private buildPdf(data: ReservationsReport): Promise<Buffer> {
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

      // Larguras conferidas com o texto extraído do PDF gerado: a coluna de
      // período precisa caber "24/07/2026 a 26/07/2026" inteiro, e os rótulos
      // numéricos não podem sair elipsados.
      const widths = [92, 98, 126, 48, 46, 50, 40, 46];
      const scale = pageWidth / widths.reduce((a, b) => a + b, 0);
      const cols = widths.map((w) => w * scale);
      const rowHeight = 18;

      const drawRow = (
        cells: string[],
        opts: { header?: boolean; chalet?: boolean } = {},
      ): void => {
        ensureSpace(rowHeight + 4);
        const y = doc.y;
        let x = doc.page.margins.left;

        if (opts.header) {
          doc.rect(x, y, pageWidth, rowHeight).fillColor('#1F4E5F').fill();
        } else if (opts.chalet) {
          doc.rect(x, y, pageWidth, rowHeight).fillColor('#D9E2E8').fill();
        }

        doc
          .font(opts.header || opts.chalet ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(8)
          .fillColor(opts.header ? '#FFFFFF' : '#000000');

        cells.forEach((cell, i) => {
          doc.text(cell, x + 4, y + 5, {
            width: cols[i] - 8,
            height: rowHeight,
            ellipsis: true,
            align: i >= 3 ? 'right' : 'left',
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
        } catch {
          // Sem logo, o relatório sai igual.
        }
      }

      doc.y = 35;
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .text('RELATÓRIO GERAL DE RESERVAS', {
          width: hasLogo ? pageWidth - 70 : pageWidth,
        });
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#555555')
        .text(
          `${data.event.name}  •  ${periodo(
            data.event.startDate,
            data.event.endDate,
          )}  •  ${STATUS_LABELS[data.event.status] ?? data.event.status}`,
          { width: hasLogo ? pageWidth - 70 : pageWidth },
        )
        .fillColor('#000000');

      doc.moveDown(1);

      drawRow(
        [
          'Chalé',
          'Proprietário / Resp.',
          'Período',
          'Diárias',
          'Adultos',
          'Crianças',
          'Álcool',
          'Pessoas',
        ],
        { header: true },
      );

      for (const chalet of data.chalets) {
        drawRow(
          [
            `${chalet.chaletNumber} — ${chalet.chaletName}`,
            chalet.ownerName ?? 'Sem proprietário',
            chalet.reservations.length === 0 ? 'Sem reserva' : '',
            '',
            String(chalet.adults),
            String(chalet.children),
            String(chalet.alcoholConsumers),
            String(chalet.totalPeople),
          ],
          { chalet: true },
        );

        for (const r of chalet.reservations) {
          drawRow([
            '',
            r.responsibleName,
            periodo(r.checkIn, r.checkOut),
            String(r.nights),
            String(r.adults),
            String(r.children),
            String(r.alcoholConsumers),
            String(r.totalPeople),
          ]);
        }
      }

      drawRow(
        [
          'TOTAL GERAL',
          `${data.totals.chaletsOccupied}/${data.chalets.length} chalés`,
          `${data.totals.reservations} reserva(s)`,
          '',
          String(data.totals.adults),
          String(data.totals.children),
          String(data.totals.alcoholConsumers),
          String(data.totals.totalPeople),
        ],
        { chalet: true },
      );

      doc.end();
    });
  }
}
