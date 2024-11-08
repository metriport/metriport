import { mrStyle } from "./mr-style";

export function buildPageHeader(): string {
  return `
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <title>Medical Record Summary</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <!-- General CSS -->
        <style type="text/css" media="all">
          ${mrStyle()}
        </style>
      </head>
  `;
}
