export function createSectionHeader(title: string, icon: string): string {
  return `
    <div class="section-header">
      <h2 class="section-title">
        <span class="section-icon"><i class="fas ${icon}"></i></span>
        ${title}
      </h2>
      <a class="scroll-top" href="#mr-header"><i class="fa-solid fa-arrow-up"></i></a>
    </div>
  `;
}
