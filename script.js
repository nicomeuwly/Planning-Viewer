const pdfjsLib = window["pdfjs-dist/build/pdf"];
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const upload = document.getElementById("pdf-upload");
const form = document.getElementById("person-container");
const copyButton = document.getElementById("copy-btn");
const exportButton = document.getElementById("export-btn");
const nameInput = document.getElementById("person-name");
const container = document.getElementById("planning");
const copyPath = `<path d="M4 0V2H5V1H14V12H13V13H15V0H4ZM1 3V16H12V3H1ZM11 15H2V4H11V15Z" fill="currentColor"/>`;
const copyDonePath = `<path fill-rule="evenodd" clip-rule="evenodd" d="M13.213 4L5.597 11.459L2.787 8.706L2 9.477L5.597 13L14 4.77L13.213 4Z" fill="currentColor"/>`;
const showMoreButton = document.getElementById("show-more-btn");
const info = document.getElementById("more-infos");
const statsContainer = document.getElementById("planning-stats");

const shopData = [{ "name": "Genève", "shopCode": "GEF", "shopAdress": "Rue de Lausanne 72, 1202 Genève" }, { "name": "Lausanne", "shopCode": "LAF", "shopAdress": "Rue du Grand-Pré 2B, 1007 Lausanne" }]

let planning = [];
let shop = "";

async function showPlanning() {
  const formData = new FormData(form);

  planning = [];
  shop = "";

  const file = upload.files[0];
  const person = formData.get("person").trim();

  if (!file || !person) {
    container.innerHTML = "<p>Sélectionnez un fichier PDF et entrez un nom.</p>";
    return;
  }

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
    const weekItems = textItems
      .slice(start, end + 1)
      .filter((item) => item.str.trim());

    const dates = weekItems
      .filter((item) => /^\d{2}\.\d{2}\.\d{2}$/.test(item.str))
      .map((item) => {
        const [day, month, year] = item.str.split(".").map(Number);
        const fullYear = year < 50 ? 2000 + year : 1900 + year;
        return new Date(Date.UTC(fullYear, month - 1, day));
      });

    const personIndex = textItems.findIndex((item) => item.str === person);
    if (personIndex === -1) continue;

    const rawSchedule = textItems
      .slice(personIndex + 1, personIndex + 14)
      .filter((i) => i.str.trim());

    const week = dates.map((date, i) => {
      const entry = rawSchedule[i]?.str || "";
      if (!shop) {
        shopData.forEach((el) => {
          if (entry.includes(el.shopCode)) {
            shop = el;
            return;
          }
        });
      }
      const isWorking = entry.includes(shop.shopCode);
      const time = isWorking ? entry.split(" ")[1] : "-";
      return { date, isWorking, time };
    });

    const section = document.createElement("section");
    section.innerHTML = `<div class="week-title"><h2>Semaine ${pageNum}</h2><button type="button" class="copy"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">${copyPath}</svg></button></div>`;
    const ul = document.createElement("ul");

    const dayNames = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

    let i = 0;
    week.forEach(({ date, isWorking, time }) => {
      i++;
      const li = document.createElement("li");
      const day = date.getDay();
      li.innerHTML = `<span class="weekday">${dayNames[day - 1]}.</span><span class="date">${date.toLocaleDateString()}</span><span class="${isWorking ? "work" : "off"}">${time}</span>`;
      ul.appendChild(li);
      if (isWorking) {
        planning.push({ date, time });
      }
      if (i < 6) {
        const hr = document.createElement("hr");
        ul.appendChild(hr);
      }
    });

    section.appendChild(ul);
    section.querySelector(".copy").addEventListener("click", async () => {
      try {
        const weekCopy = week.filter((el) => {
          return el.isWorking === true;
        });
        weekCopy.forEach((el) => {
          delete el.isWorking;
        });
        await navigator.clipboard.writeText(JSON.stringify(weekCopy));
        section.querySelector("svg").innerHTML = copyDonePath;
        setTimeout(() => {
          section.querySelector("svg").innerHTML = copyPath;
        }, 2000);
      } catch (error) {
        console.error(error.message);
      }
    });
    container.appendChild(section);
  }

  if (container.innerHTML === "") {
    container.innerHTML = "<p>Aucune donnée trouvée pour cette personne.</p>";
    copyButton.disabled = true;
    exportButton.disabled = true;
    statsContainer.classList.add("hidden");
  } else {
    copyButton.disabled = false;
    exportButton.disabled = false;
    statsContainer.classList.remove("hidden");
    document.getElementById("month").innerHTML = new Date(planning[0].date).toLocaleString("fr-FR", { month: "long", year: "numeric"})
    document.getElementById("days").innerHTML = planning.length;
    document.getElementById("rate").innerHTML = Math.round(planning.length / pdf.numPages * 20) + "%";
  }
};

form.addEventListener("submit", (e) => {
  e.preventDefault();
  showPlanning();
});

copyButton.addEventListener("click", () =>
  writeClipboardText(JSON.stringify(planning))
);

async function writeClipboardText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.error(error.message);
  }
}

function generateICS(planning) {
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Planning-Viewer//FR",
    "CALSCALE:GREGORIAN",
  ];

  const events = planning.map(({ date, time }, i) => {
    const [start, end] = time.split("-");
    const [startHour, startMinute] = start.split(":");
    const [endHour, endMinute] = end.split(":");

    const format = (d, h, m) => d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2) + "T" + h + m + "00Z";

    return [
      "BEGIN:VEVENT",
      `UID:event${i}@planning-viewer`,
      `DTSTART;TZID=Europe/Zurich:${format(date, startHour, startMinute)}`,
      `DTEND;TZID=Europe/Zurich:${format(date, endHour, endMinute)}`,
      `SUMMARY:Travail`,
      `DESCRIPTION:Digitec Galaxus AG, ${shop.shopAdress}`,
      "END:VEVENT",
    ].join("\n");
  });

  const footer = ["END:VCALENDAR"];

  const icsContent = [...header, ...events, ...footer].join("\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "DG-Planning.ics";
  link.click();
}

showMoreButton.addEventListener("click", () => {
  if (info.classList.contains("hidden")) {
    info.classList.remove("hidden");
    showMoreButton.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M8.5 1L3.5 5.95L4.213 6.657L7.995 2.914V15H9.005V2.914L12.785 6.657L13.499 5.95L8.5 1Z" fill="currentColor"/></svg>Afficher moins`;
  } else {
    info.classList.add("hidden");
    showMoreButton.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.995 1V13.086L4.213 9.343L3.5 10.05L7.784 14.293L8.5 15L13.499 10.05L12.785 9.343L9.005 13.086V1H7.995Z" fill="currentColor"/></svg>Afficher plus`;
  }
});

exportButton.addEventListener("click", () => {
  if (planning.length > 0) {
    generateICS(planning);
  }
  else {
    alert("Aucun planning à exporter.");
  }
});