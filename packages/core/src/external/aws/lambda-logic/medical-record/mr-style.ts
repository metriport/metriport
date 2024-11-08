import { noteStyle } from "./sections/notes/style";
import { medicationStyle } from "./sections/medications/style";
import { vitalStyle } from "./sections/vitals/style";
import { labStyle } from "./sections/labs/style";
import { socialHistoryStyle } from "./sections/social-histroy/style";
import { sharedStyle } from "./sections/shared/shared-style";

export function mrStyle(): string {
  return (
    pageStyle +
    noteStyle +
    medicationStyle +
    vitalStyle +
    labStyle +
    socialHistoryStyle +
    sharedStyle
  );
}

const pageStyle = `
    @media print {
        @page {
            size: A4;
        }
        body {
            margin: 1.5cm;
        }
    }
    body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 1rem;
        background: white;
        color: #333;
        font-size: 14px;
    }

    .container {
        max-width: 675px;
        margin: 0 auto;
    }

    .logo-container {
      display: flex;
      justify-content: left;
      width: 100%;
      margin-bottom: 3rem;
    }

    .logo-container img {
      height: 50px;
    }

    .date {
        color: #666;
        font-size: 1rem;
        margin-bottom: 6px;
    }

    .title {
        font-size: 2rem;
        margin-bottom: 0.5rem;
        display: flex;
        flex-direction: column;
        margin-top: 0px;
    }

    .company-name {
        font-weight: bold;
        margin-bottom: 4px;
    }

    .record-title {
        font-weight: normal;
    }

    .title-underline {
        width: 75px;
        height: 2px;
        background-color: #748df0;
        margin-bottom: 1.5rem;
    }

    .demographics {
        margin-bottom: 2rem;
    }

    .demographics-title {
        font-size: 1.25rem;
        font-weight: normal;
        margin-bottom: 1.5rem;
        display: flex;
        align-items: center;
    }

    .demographics-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 1rem;
    }

    .demographics-row {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
    }

    .demographics-item {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
    }

    .demographics-icon-wrapper {
        width: 32px;
        height: 32px;
        background-color: #f0f2ff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .demographics-icon {
        font-size: 1rem;
        color: #748df0;
    }

    .demographics-content {
        flex-grow: 1;
    }

    .demographics-label {
        color: #666;
        margin-bottom: 0.25rem;
        display: block;
        font-size: 0.9rem;
    }

    .demographics-value {
        font-weight: bold;
        color: #333;
        font-size: 1rem;
        word-break: break-word;
    }

    .toc {
        margin: 2rem 0;
    }

    .toc-title {
        font-size: 1.25rem;
        font-weight: normal;
        margin-bottom: 1.5rem;
        letter-spacing: 1px;
    }

    .toc-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem 2rem;
    }

    .toc-item {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        text-decoration: none;
        color: #333;
        padding: 0.5rem;
        border-radius: 4px;
        background-color: #f0f2ff;
        border: 1px solid #748df0;
    }

    .toc-icon {
        font-size: 1.5rem;
        color: #748df0;
        width: 48px;
        text-align: center;
    }

    .toc-text {
        font-size: 1.1rem;
        color: #333;
    }

    .section {
        margin-bottom: 2rem;
        page-break-inside: avoid;
    }

    .section-title {
        font-size: 1.5rem;
        font-weight: bold;
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .section-icon {
        font-size: 1.5rem;
        color: #748df0;
    }

    .table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 1rem;
    }

    .table th,
    .table td {
        border: 1px solid #e0e0e0;
        padding: 8px;
        text-align: left;
    }

    .table th {
        background-color: #748df0;
        color: white;
        font-weight: bold;
    }

    .table tr:nth-child(even) {
        background-color: #f8f9ff;
    }

    .table-code {
        font-family: monospace;
        color: #666;
    }

    @media print {
        body {
            background: white;
        }
        .table {
            page-break-inside: auto;
        }
        .table tr {
            page-break-inside: avoid;
            page-break-after: auto;
        }
        .table thead {
            display: table-header-group;
        }
    }
  `;
