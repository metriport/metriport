import { createSectionHeader } from "../shared/section-header";

export function createRelatedPersonsSections(): string {
  return `
    <div id="related-persons" class="section">
      ${createSectionHeader("Related Persons", "fa-user-friends")}

      <table class="table">
        <thead>
            <tr>
                <th>Name</th>
                <th>Relationships</th>
                <th>Contacts</th>
                <th>Addresses</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Sherri Fry</td>
                <td>mother</td>
                <td>phone- mobile: +1-222-333-4444, phone- home: +1-222-333-4567</td>
                <td>1111 Example St PHILADELPHIA, PA 88776</td>
            </tr>
            <tr>
                <td>Yancy Fry, Sr.</td>
                <td>father</td>
                <td>phone- home: +1-222-333-4567, phone- work: +1-222-333-0000</td>
                <td>-</td>
            </tr>
        </tbody>
      </table>
    </div>
  `;
}
