export const sharedStyle = `
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .scroll-top {
    background-color: #748df0;
    color: white;
    border: none;
    width: 35px;
    height: 35px;
    font-size: 16px;
    cursor: pointer;
    border-radius: 25%;
    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
  }

  .main-row {
    background-color: #f8f9ff;
  }

  .history-row {
    background-color: white;
  }

  .main-name {
    font-weight: bold;
  }

  .main-details {
    font-size: 0.9em;
    color: #666;
  }

  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 1rem;
    font-size: 0.8rem;
    background: #e6ffe6;
    color: #008000;
  }

  .timeline-date {
    font-weight: bold;
    color: #748df0;
  }

  .history-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .history-date {
    flex: 0 0 120px;
  }

  .history-event {
    flex: 1;
  }
`;
