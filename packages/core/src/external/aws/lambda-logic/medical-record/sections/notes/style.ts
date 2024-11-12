export const noteStyle = `
  .note {
      margin-bottom: 2rem;
      padding: 1.5rem;
      background-color: #ffffff;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
  }

  .note:last-child {
      margin-bottom: 0;
  }

  .note-header {
      margin-bottom: 1.5rem;
  }

  .note-location {
      display: inline-flex;
      align-items: center;
      background-color: #748df0;
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 1rem;
      font-size: 0.875rem;
      margin-bottom: 0.5rem;
  }

  .note-location i {
      margin-right: 0.5rem;
  }

  .note-title {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0.5rem 0 1rem 0;
      color: #333;
  }

  .note-meta {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: #666;
      font-size: 0.875rem;
  }

  .provider-avatar {
      width: 2rem;
      height: 2rem;
      background-color: #748df0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
  }

  .provider-avatar i {
      font-size: 1rem;
  }

  .note-content {
      margin-bottom: 1rem;
  }

  .note-text {
      margin-bottom: 1.5rem;
      line-height: 1.6;
      white-space: pre-line;
  }

  .note-plan {
      margin-bottom: 1.5rem;
  }

  .note-plan-title {
      font-weight: bold;
      margin-bottom: 0.5rem;
  }

  .note-plan-list {
      list-style: none;
      padding: 0;
      margin: 0;
  }

  .note-plan-item {
      position: relative;
      padding-left: 1rem;
      margin-bottom: 0.5rem;
  }

  .note-plan-item::before {
      content: "-";
      position: absolute;
      left: 0;
  }

  .diagnosis-box {
      background-color: #fff0f5;
      border-left: 4px solid #ff69b4;
      padding: 1rem;
      margin-top: 1rem;
      margin-bottom: 0; /* Changed from 1rem to 0 */
  }

  .diagnosis-title {
      font-weight: bold;
      color: #ff69b4;
      margin-bottom: 0.5rem;
      font-size: 1rem;
  }

  .diagnosis-list {
      list-style: none;
      padding: 0;
      margin: 0;
  }

  .diagnosis-item {
      position: relative;
      padding-left: 1rem;
      margin-bottom: 0.25rem;
  }

  .diagnosis-item::before {
      content: "•";
      position: absolute;
      left: 0;
      color: #ff69b4;
  }
`;
