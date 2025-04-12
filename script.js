const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const upload = document.getElementById("pdf-upload");
const button = document.getElementById("process-btn");
const copyButton = document.getElementById("copy-btn");
const nameInput = document.getElementById("person-name");
const container = document.getElementById("planning");

let planning = [];

button.addEventListener("click", async () => {
    const file = upload.files[0];
    const person = nameInput.value.trim();
    if (!file || !person) return alert("Sélectionnez un fichier PDF et entrez un nom.");

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    container.innerHTML = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const textItems = textContent.items;

        const monday = textItems.find((item) => item.str === "Montag");
        const sunday = textItems.find((item) => item.str === "Sonntag");
        if (!monday || !sunday) continue;

        const start = textItems.indexOf(monday);
        const end = textItems.indexOf(sunday);
        const weekItems = textItems.slice(start, end + 1).filter((item) => item.str.trim());

        const dates = weekItems
            .filter(item => /^\d{2}\.\d{2}\.\d{2}$/.test(item.str))
            .map(item => {
                const [day, month, year] = item.str.split('.').map(Number);
                const fullYear = year < 50 ? 2000 + year : 1900 + year;
                return new Date(Date.UTC(fullYear, month - 1, day));
            });

        const personIndex = textItems.findIndex((item) => item.str === person);
        if (personIndex === -1) continue;

        const rawSchedule = textItems.slice(personIndex + 1, personIndex + 14).filter(i => i.str.trim());

        const week = dates.map((date, i) => {
            const entry = rawSchedule[i]?.str || "";
            const isWorking = entry.includes("LAF");
            const time = isWorking ? entry.split(" ")[1] : "-";
            return { date, isWorking, time };
        });

        const section = document.createElement("section");
        section.innerHTML = `<div class="week-title"><h2>Semaine ${pageNum}</h2><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 0V2H5V1H14V12H13V13H15V0H4ZM1 3V16H12V3H1ZM11 15H2V4H11V15Z" fill="black"/></svg></div>`;
        const ul = document.createElement("ul");

        const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

        let i = 0;
        week.forEach(({ date, isWorking, time }) => {
            i++;
            const li = document.createElement("li");
            const day = date.getDay();
            li.innerHTML = `<span class="weekday">${dayNames[day - 1]}.</span><span class="date">${date.toLocaleDateString("fr-CH")}</span><span class="${isWorking ? 'work' : 'off'}">${time}</span>`;
            ul.appendChild(li);
            if (isWorking) {
                planning.push({ name: person, date, time });
            }
            if (i < 6) {
                const hr = document.createElement("hr");
                ul.appendChild(hr);
            }
        });

        section.appendChild(ul);
        container.appendChild(section);
    }

    if (container.innerHTML === "") {
        container.innerHTML = "<p>Aucune donnée trouvée pour cette personne.</p>";
        copyButton.disabled = true;
    } else {
        copyButton.disabled = false;
    }
});
