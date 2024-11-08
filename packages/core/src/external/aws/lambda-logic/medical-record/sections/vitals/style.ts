export const vitalStyle = `
  .vitals-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
      gap: 20px;
  }

  .vital-card {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
  }

  .vital-card-header {
      background-color: #748df0;
      color: white;
      padding: 10px;
      font-weight: bold;
  }

  .vital-card-content {
      padding: 10px;
  }

  .chart-container {
      height: 250px;
      position: relative;
  }

  @media print {
      body {
          background: white;
      }
      .vital-card {
          break-inside: avoid;
          page-break-inside: avoid;
      }
  }

  @media (max-width: 950px) {
      .vitals-grid {
          grid-template-columns: 1fr;
      }
  }
`;
