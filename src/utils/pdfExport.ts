import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Product, StockMovement, SystemSettings } from '../types';

export type ReportType = 'ENTRADAS' | 'SAIDAS' | 'CRITICOS';

export interface ExportReportPdfParams {
  reportType: ReportType;
  entries: StockMovement[];
  exits: StockMovement[];
  criticalProducts: Product[];
  settings: SystemSettings;
  filters: {
    searchQuery: string;
    selectedGroup: string;
    selectedCollaborator?: string;
    startDate: string;
    endDate: string;
  };
}

export interface ExportReportPdfResult {
  filename: string;
  reportTitle: string;
  recordCount: number;
  summaryLine: string;
  blob: Blob;
}

const getReportTitle = (reportType: ReportType): string => {
  if (reportType === 'ENTRADAS') return 'Relatório de Entradas de Materiais';
  if (reportType === 'SAIDAS') return 'Relatório de Saídas & Requisições de Obras';
  return 'Relatório de Produtos Críticos (Abaixo do Mínimo)';
};

export function generateReportPdf({
  reportType,
  entries,
  exits,
  criticalProducts,
  settings,
  filters,
}: ExportReportPdfParams): ExportReportPdfResult {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const isoDate = now.toISOString().split('T')[0];

  const reportTitle = getReportTitle(reportType);
  const companyName = settings.companyName || 'QHS ENGENHARIA LTDA';

  // Brand badge
  doc.setFillColor(220, 38, 38); // red-600
  doc.roundedRect(marginX, 12, 14, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('QHS', marginX + 7, 20.5, { align: 'center' });

  // Company title & details
  doc.setTextColor(24, 24, 27); // zinc-900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(companyName.toUpperCase(), marginX + 18, 17.5);

  doc.setTextColor(82, 82, 91); // zinc-600
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `CNPJ: ${settings.cnpj || '-'}  ·  Departamento de Almoxarifado & Estoque`,
    marginX + 18,
    23
  );

  // Right header metadata
  doc.setTextColor(82, 82, 91);
  doc.setFontSize(8.5);
  doc.text(`Emissão: ${dateStr} às ${timeStr}`, pageWidth - marginX, 17, { align: 'right' });
  doc.setTextColor(24, 24, 27);
  doc.setFont('helvetica', 'bold');
  doc.text(`Documento: ${reportTitle}`, pageWidth - marginX, 22.5, { align: 'right' });

  // Header bottom border
  doc.setDrawColor(24, 24, 27);
  doc.setLineWidth(0.6);
  doc.line(marginX, 29, pageWidth - marginX, 29);

  // Report title & active filters
  doc.setTextColor(24, 24, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(reportTitle.toUpperCase(), marginX, 36.5);

  const filterParts: string[] = [];
  filterParts.push(
    `Grupo: ${filters.selectedGroup === 'TODOS' ? 'Todos' : filters.selectedGroup}`
  );
  if (reportType !== 'CRITICOS' && (filters.startDate || filters.endDate)) {
    filterParts.push(
      `Período: ${filters.startDate || '...'} até ${filters.endDate || '...'}`
    );
  }
  if (
    reportType === 'SAIDAS' &&
    filters.selectedCollaborator &&
    filters.selectedCollaborator !== 'TODOS'
  ) {
    filterParts.push(`Colaborador: ${filters.selectedCollaborator}`);
  }
  if (filters.searchQuery.trim()) {
    filterParts.push(`Busca: "${filters.searchQuery.trim()}"`);
  }

  let recordCount = 0;
  let summaryLine = '';
  let head: string[][] = [];
  let body: (string | number)[][] = [];
  let columnStyles: Record<number, { halign?: 'left' | 'center' | 'right'; cellWidth?: number }> = {};

  if (reportType === 'ENTRADAS') {
    recordCount = entries.length;
    const totalReceived = entries.reduce((acc, e) => acc + e.quantity, 0);
    summaryLine = `${recordCount} registro(s)  ·  Total recebido: +${totalReceived} un`;
    head = [
      [
        'Data & Horário',
        'Código',
        'Produto Recebido',
        'Grupo',
        'Qtd. Recebida',
        'Estoque Após Entrada',
        'Responsável',
      ],
    ];
    body =
      entries.length > 0
        ? entries.map((e) => [
            e.date,
            e.productCode,
            e.productName,
            e.group,
            `+${e.quantity} un`,
            `${e.stockAfterMovement} un`,
            e.responsibleUser,
          ])
        : [['Nenhum registro de entrada corresponde aos filtros selecionados.', '', '', '', '', '', '']];
    columnStyles = {
      0: { cellWidth: 34 },
      1: { cellWidth: 28 },
      3: { cellWidth: 32 },
      4: { halign: 'right', cellWidth: 28 },
      5: { halign: 'right', cellWidth: 34 },
      6: { cellWidth: 42 },
    };
  } else if (reportType === 'SAIDAS') {
    recordCount = exits.length;
    const totalWithdrawn = exits.reduce((acc, s) => acc + s.quantity, 0);
    summaryLine = `${recordCount} registro(s)  ·  Total retirado: -${totalWithdrawn} un`;
    head = [
      [
        'Data & Horário',
        'Código',
        'Produto Retirado',
        'Grupo',
        'Qtd. Retirada',
        'Saldo Restante',
        'Colaborador que Retirou',
        'Obra / Destino',
        'Responsável',
      ],
    ];
    body =
      exits.length > 0
        ? exits.map((s) => [
            s.date,
            s.productCode,
            s.isNegativeStockAuthorized
              ? `${s.productName}\n(Aut. Excepcional: ${s.authorizedBy || '-'})`
              : s.productName,
            s.group,
            `-${s.quantity} un`,
            `${s.stockAfterMovement} un`,
            s.withdrawnBy || '-',
            s.destination || '-',
            s.responsibleUser,
          ])
        : [
            [
              'Nenhum registro de saída corresponde aos filtros selecionados.',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
            ],
          ];
    columnStyles = {
      0: { cellWidth: 30 },
      1: { cellWidth: 24 },
      3: { cellWidth: 24 },
      4: { halign: 'right', cellWidth: 24 },
      5: { halign: 'right', cellWidth: 24 },
    };
  } else {
    recordCount = criticalProducts.length;
    const totalToBuy = criticalProducts.reduce(
      (acc, p) => acc + Math.max(1, p.minStock * 2 - p.currentStock),
      0
    );
    summaryLine = `${recordCount} item(ns) abaixo do mínimo  ·  Sugestão total de compra: +${totalToBuy} un`;
    head = [
      [
        'Código',
        'Produto',
        'Grupo',
        'Estoque Atual',
        'Estoque Mínimo',
        'Sugestão de Reposição',
        'Situação',
      ],
    ];
    body =
      criticalProducts.length > 0
        ? criticalProducts.map((p) => {
            const suggestBuy = Math.max(1, p.minStock * 2 - p.currentStock);
            const isZeroOrNeg = p.currentStock <= 0;
            return [
              p.code,
              p.name,
              p.group,
              `${p.currentStock} un`,
              `${p.minStock} un`,
              `+${suggestBuy} un`,
              isZeroOrNeg ? 'Estoque Zerado / Negativo' : 'Abaixo do Mínimo',
            ];
          })
        : [
            [
              'Todos os produtos estão com níveis de estoque operacional adequados.',
              '',
              '',
              '',
              '',
              '',
              '',
            ],
          ];
    columnStyles = {
      0: { cellWidth: 30 },
      2: { cellWidth: 34 },
      3: { halign: 'right', cellWidth: 28 },
      4: { halign: 'right', cellWidth: 28 },
      5: { halign: 'right', cellWidth: 38 },
      6: { halign: 'center', cellWidth: 44 },
    };
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(82, 82, 91);
  doc.text(`${summaryLine}   |   ${filterParts.join('  ·  ')}`, marginX, 42);

  autoTable(doc, {
    startY: 46,
    margin: { left: marginX, right: marginX, bottom: 18 },
    head,
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.8,
      textColor: [24, 24, 27],
      lineColor: [212, 212, 216],
      lineWidth: 0.2,
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [24, 24, 27],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 3.2,
    },
    alternateRowStyles: {
      fillColor: [244, 244, 245],
    },
    columnStyles,
    didParseCell: (data) => {
      if (data.section !== 'body') return;

      // Empty state row spans cleanly in appearance
      if (recordCount === 0 && data.column.index === 0) {
        data.cell.colSpan = head[0].length;
        data.cell.styles.halign = 'center';
        data.cell.styles.textColor = [82, 82, 91];
        return;
      }

      if (reportType === 'ENTRADAS' && data.column.index === 4) {
        data.cell.styles.textColor = [4, 120, 87];
        data.cell.styles.fontStyle = 'bold';
      }

      if (reportType === 'SAIDAS') {
        if (data.column.index === 4) {
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.column.index === 5) {
          const val = parseFloat(String(data.cell.raw));
          if (!Number.isNaN(val) && val < 0) {
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }

      if (reportType === 'CRITICOS') {
        if (data.column.index === 3) {
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.column.index === 5) {
          data.cell.styles.textColor = [146, 64, 14];
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.column.index === 6) {
          const rawStr = String(data.cell.raw);
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = rawStr.includes('Zerado')
            ? [185, 28, 28]
            : [180, 83, 9];
        }
      }
    },
  });

  // Page footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(228, 228, 231);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 13, pageWidth - marginX, pageHeight - 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(113, 113, 122);
    doc.text(
      `${companyName} · Relatório gerado em ${dateStr} às ${timeStr}`,
      marginX,
      pageHeight - 8.5
    );
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - marginX, pageHeight - 8.5, {
      align: 'right',
    });
  }

  const filename = `qhs_engenharia_relatorio_${reportType.toLowerCase()}_${isoDate}.pdf`;
  const blob = doc.output('blob');
  doc.save(filename);

  return {
    filename,
    reportTitle,
    recordCount,
    summaryLine,
    blob,
  };
}
