const webroot = document.querySelector("meta[name='webroot']").content;
const fileInput = document.querySelector('input[type="file"]');
const dropZone = document.getElementById("dropzone");
const convertButton = document.querySelector("input[type='submit']");
const fileNames = [];
// per-file chosen target: { "filename.ext": "ext,converter" }
const fileTargets = {};
let fileType;
let pendingFiles = 0;
let formatSelected = false;

const isNewUi = () => document.documentElement.classList.contains("new-ui");

// ---------- category map (mirror of src/helpers/categories.ts) ----------
// Kept duplicated client-side so the per-row popup can filter by input category
// without an extra round-trip. If you add a category server-side, mirror it here.
const CAT_EXTS = {
  Image: ["jpg","jpeg","png","gif","webp","bmp","tiff","tif","avif","heic","heif","jxl","ico","tga","pbm","pgm","ppm","pnm","exr","hdr","dds","psd","xcf","raw","cr2","nef","arw","dng","rw2","orf","raf","pcx","sgi","xpm"],
  Video: ["mp4","mov","mkv","avi","webm","wmv","flv","m4v","mpg","mpeg","3gp","ogv","ts","vob","asf","rm","rmvb","f4v"],
  Audio: ["mp3","wav","flac","aac","ogg","m4a","opus","wma","aiff","aif","ac3","amr","au","mka","oga","voc","caf"],
  Vector: ["svg","eps","ai","emf","wmf","cgm","dxf"],
  Document: ["pdf","doc","docx","odt","txt","md","rtf","html","htm","tex","rst","epub","fodt","ott","uot","wps","abw","lwp","pages","key","ppt","pptx","odp","fodp","otp","xls","xlsx","ods","fods","ots","csv","tsv","msg","eml","vcf","ics"],
  Ebook: ["mobi","azw","azw3","azw4","fb2","lit","lrf","pdb","kfx","kepub","snb","pml","rb","tcr","txtz"],
  "3D": ["obj","stl","ply","fbx","dae","gltf","glb","3ds","blend","x3d","amf","off","x","iqe","iqm","md2","md3","md5"],
  Data: ["json","yaml","yml","xml","toml","ini","hcl"],
  Archive: ["zip","tar","gz","bz2","7z","rar","xz","zst"],
};
const EXT_TO_CAT = {};
for (const [cat, exts] of Object.entries(CAT_EXTS)) for (const e of exts) EXT_TO_CAT[e] = cat;
const catFor = (ext) => EXT_TO_CAT[(ext || "").toLowerCase().replace(/^\./, "")] || "Other";

// Sensible output categories given an input category. Power users can flip
// the "show all" switch in the popup to bypass this.
const SENSIBLE = {
  Image:    ["Image", "Vector", "Document"],
  Vector:   ["Vector", "Image", "Document"],
  Video:    ["Video", "Audio", "Image"],     // image = frame extract
  Audio:    ["Audio"],
  Document: ["Document", "Image", "Ebook", "Data"],
  Ebook:    ["Ebook", "Document"],
  "3D":     ["3D", "Image"],
  Data:     ["Data", "Document"],
  Archive:  ["Archive"],
  Other:    null, // null = show all
};
const sensibleFor = (inputCat) => SENSIBLE[inputCat] ?? null;

// File-input "accept" used to be locked to the first dropped extension, which
// silently rejected every other type. Leave it open so the user can mix files.
// (The backend still validates per-converter, so nothing actually breaks.)

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");

  const files = e.dataTransfer.files;
  if (files.length === 0) {
    console.warn("No files dropped — likely a URL or unsupported source.");
    return;
  }
  for (const file of files) handleFile(file);
});

// Build a row. In new-ui mode each row gets its own "Choose format" button
// which opens a popup scoped to that file's possible targets.
function handleFile(file) {
  const fileList = document.querySelector("#file-list");
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
  const safeName = file.name.replaceAll('"', "&quot;");

  const row = document.createElement("tr");
  row.dataset.filename = file.name;
  row.dataset.ext = ext;
  row.innerHTML = `
    <td>${file.name}</td>
    <td><progress max="100" class="inline-block h-2 appearance-none overflow-hidden rounded-full border-0 bg-neutral-700 bg-none text-accent-500 accent-accent-500 [&::-moz-progress-bar]:bg-accent-500 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:[background:none] [&[value]::-webkit-progress-value]:bg-accent-500 [&[value]::-webkit-progress-value]:transition-[inline-size]"></progress></td>
    <td>${(file.size / 1024).toFixed(2)} kB</td>
    <td class="per-row-target-cell">
      <button type="button" class="per-row-target-btn rounded-sm bg-neutral-700 px-2 py-1 text-sm hover:bg-neutral-600" data-filename="${safeName}" data-ext="${ext}">
        Choose format
      </button>
    </td>
    <td><a onclick="deleteRow(this)">Remove</a></td>
  `;

  // Classic flow still needs the global picker populated based on first file.
  if (!fileType) {
    fileType = ext;
    setTitle();

    fetch(`${webroot}/conversions`, {
      method: "POST",
      body: JSON.stringify({ fileType }),
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.text())
      .then((html) => {
        selectContainer.innerHTML = html;
        wireClassicPicker();
      })
      .catch(console.error);
  }

  fileList.appendChild(row);
  file.htmlRow = row;
  fileNames.push(file.name);
  setTitle(); // refresh after every add — handles mixed-type batches
  uploadFile(file);
}

const selectContainer = document.querySelector("form .select_container");

// ---------- classic picker (untouched behavior, just isolated) ----------
function wireClassicPicker() {
  const popup = document.querySelector(".convert-classic-view");
  if (!popup) return;
  const convertToInput = document.querySelector("input[name='convert_to_search']");
  const convertToElement = document.querySelector("select[name='convert_to']");
  const groupEls = popup.querySelectorAll(".convert_to_group");
  const convertToGroups = {};

  const showMatching = (search) => {
    for (const [targets, groupElement] of Object.values(convertToGroups)) {
      let matches = 0;
      for (const target of targets) {
        if (target.dataset.target.includes(search)) {
          matches++;
          target.classList.remove("hidden");
          target.classList.add("flex");
        } else {
          target.classList.add("hidden");
          target.classList.remove("flex");
        }
      }
      if (matches === 0) {
        groupElement.classList.add("hidden");
        groupElement.classList.remove("flex");
      } else {
        groupElement.classList.remove("hidden");
        groupElement.classList.add("flex");
      }
    }
  };

  for (const groupElement of groupEls) {
    const groupName = groupElement.dataset.converter;
    const targets = Array.from(groupElement.querySelectorAll(".target"));
    for (const target of targets) {
      target.onmousedown = () => {
        convertToElement.value = target.dataset.value;
        convertToInput.value = `${target.dataset.target} using ${target.dataset.converter}`;
        formatSelected = true;
        if (pendingFiles === 0 && fileNames.length > 0) convertButton.disabled = false;
        showMatching("");
      };
    }
    convertToGroups[groupName] = [targets, groupElement];
  }

  convertToInput.addEventListener("input", (e) => showMatching(e.target.value.toLowerCase()));
  convertToInput.addEventListener("search", () => {
    convertButton.disabled = true;
    formatSelected = false;
  });
  convertToInput.addEventListener("blur", (e) => {
    if (e?.relatedTarget?.classList?.contains("target")) {
      popup.classList.add("hidden");
      popup.classList.remove("flex");
      return;
    }
    popup.classList.add("hidden");
    popup.classList.remove("flex");
  });
  convertToInput.addEventListener("focus", () => {
    if (isNewUi()) return; // new-ui uses per-row picker, suppress global popup
    popup.classList.remove("hidden");
    popup.classList.add("flex");
  });
}

// ---------- new-ui per-row picker ----------
// Cache of {ext -> [{target, converter}, ...]} fetched lazily from /conversions.
const newUiTargetCache = {};

async function fetchTargetsForExt(ext) {
  if (newUiTargetCache[ext]) return newUiTargetCache[ext];
  const res = await fetch(`${webroot}/conversions`, {
    method: "POST",
    body: JSON.stringify({ fileType: ext }),
    headers: { "Content-Type": "application/json" },
  });
  const html = await res.text();
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  // Scope to the new-view container so we don't get duplicates from the
  // classic view (server renders both). Each item also carries its
  // category from the parent .category-group's data-category.
  const items = [];
  const seen = new Set();
  for (const group of tmp.querySelectorAll(".convert-new-view .category-group")) {
    const category = group.dataset.category || "Other";
    for (const btn of group.querySelectorAll(".target")) {
      const key = `${btn.dataset.target}|${btn.dataset.converter}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        target: btn.dataset.target,
        converter: btn.dataset.converter,
        value: btn.dataset.value,
        category,
      });
    }
  }
  newUiTargetCache[ext] = items;
  return items;
}

// Single floating popup reused for whichever row was clicked.
let rowPopup;
function ensureRowPopup() {
  if (rowPopup) return rowPopup;
  rowPopup = document.createElement("div");
  rowPopup.id = "per-row-popup";
  rowPopup.className =
    "fixed z-50 hidden max-h-[60vh] w-[min(28rem,90vw)] overflow-y-auto rounded-sm bg-neutral-800 p-3 shadow-xl border border-neutral-700";
  rowPopup.innerHTML = `
    <input type="search" id="per-row-search" placeholder="Search format…" autocomplete="off"
      class="mb-2 w-full rounded-sm bg-neutral-900 p-2 text-sm" />
    <label class="mb-2 flex items-center gap-2 text-xs text-neutral-400 select-none">
      <input type="checkbox" id="per-row-showall" class="accent-accent-500" />
      Show all formats (incl. unusual conversions)
    </label>
    <div id="per-row-list" class="flex flex-col gap-2"></div>
  `;
  document.body.appendChild(rowPopup);
  document.addEventListener("mousedown", (e) => {
    if (!rowPopup.contains(e.target) && !e.target.classList.contains("per-row-target-btn")) {
      rowPopup.classList.add("hidden");
    }
  });
  return rowPopup;
}

function maybeEnableSubmit() {
  if (pendingFiles !== 0) return;
  if (fileNames.length === 0) return;
  if (isNewUi()) {
    // require every uploaded file to have a chosen target
    const allChosen = fileNames.every((f) => fileTargets[f]);
    convertButton.disabled = !allChosen;
    formatSelected = allChosen;
  } else if (formatSelected) {
    convertButton.disabled = false;
  }
}

function renderRowPopup(filename, ext) {
  const popup = ensureRowPopup();
  const list = popup.querySelector("#per-row-list");
  const search = popup.querySelector("#per-row-search");
  const showAll = popup.querySelector("#per-row-showall");
  list.innerHTML = `<div class="text-sm text-neutral-400">Loading…</div>`;

  const inputCat = catFor(ext);
  const allowed = sensibleFor(inputCat); // null = no filter

  fetchTargetsForExt(ext).then((items) => {
    if (!items.length) {
      list.innerHTML = `<div class="text-sm text-neutral-400">No converters available for .${ext}</div>`;
      return;
    }

    const order = ["Image", "Video", "Audio", "Document", "Vector", "Ebook", "3D", "Data", "Archive", "Other"];

    const render = () => {
      const includeAll = showAll.checked || !allowed;
      const filtered = includeAll ? items : items.filter((it) => allowed.includes(it.category || "Other"));
      const byCat = {};
      for (const it of filtered) (byCat[it.category || "Other"] ||= []).push(it);
      list.innerHTML = "";
      if (!filtered.length) {
        list.innerHTML = `<div class="text-sm text-neutral-400">No common targets for .${ext}. Toggle "Show all" for the full list.</div>`;
        return;
      }
      for (const cat of order) {
        const targets = byCat[cat];
        if (!targets || !targets.length) continue;
        const group = document.createElement("div");
        group.className = "border-b border-neutral-700 pb-2";
        const head = document.createElement("div");
        head.className = "text-xs font-semibold uppercase tracking-wider mb-1";
        head.style.color = "var(--accent-500, #f97316)";
        head.textContent = cat;
        group.appendChild(head);
        const row = document.createElement("div");
        row.className = "flex flex-wrap gap-1";
        for (const t of targets) {
          const b = document.createElement("button");
          b.type = "button";
          b.className =
            "rounded-sm bg-neutral-700 px-2 py-1 text-sm hover:bg-neutral-600 target-pick";
          b.textContent = t.target;
          b.title = `via ${t.converter}`;
          b.dataset.value = t.value;
          b.dataset.target = t.target;
          b.dataset.converter = t.converter;
          b.addEventListener("click", () => {
            fileTargets[filename] = t.value;
            const rowEl = document.querySelector(`tr[data-filename="${CSS.escape(filename)}"]`);
            if (rowEl) {
              const btn = rowEl.querySelector(".per-row-target-btn");
              if (btn) btn.textContent = `→ .${t.target}`;
            }
            popup.classList.add("hidden");
            maybeEnableSubmit();
          });
          row.appendChild(b);
        }
        group.appendChild(row);
        list.appendChild(group);
      }
      const filter = () => {
        const q = search.value.toLowerCase();
        for (const btn of list.querySelectorAll(".target-pick")) {
          btn.style.display = btn.dataset.target.toLowerCase().includes(q) ? "" : "none";
        }
      };
      search.oninput = filter;
    };

    showAll.checked = false;
    showAll.onchange = render;
    render();
    search.value = "";
    setTimeout(() => search.focus(), 0);
  });
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".per-row-target-btn");
  if (!btn) return;
  const popup = ensureRowPopup();
  const rect = btn.getBoundingClientRect();
  popup.style.top = `${rect.bottom + window.scrollY + 4}px`;
  popup.style.left = `${Math.max(8, rect.left + window.scrollX - 100)}px`;
  popup.classList.remove("hidden");
  renderRowPopup(btn.dataset.filename, btn.dataset.ext);
});

// ---------- file input change ----------
fileInput.addEventListener("change", (e) => {
  const files = e.target.files;
  for (const file of files) handleFile(file);
});

const setTitle = () => {
  const title = document.querySelector("h1");
  // Title shows the input ext only when every queued file shares one.
  // Mixed batches collapse to a plain "Convert" so it stops lying about .png.
  const exts = new Set();
  for (const tr of document.querySelectorAll("#file-list tr[data-ext]")) {
    exts.add(tr.dataset.ext);
  }
  if (exts.size === 1) {
    title.textContent = `Convert .${[...exts][0]}`;
  } else if (exts.size > 1) {
    title.textContent = `Convert ${exts.size} file types`;
  } else {
    title.textContent = "Convert";
  }
};

const deleteRow = (target) => {
  const tr = target.parentElement.parentElement;
  const filename = tr.dataset.filename || tr.children[0].textContent;
  tr.remove();

  const index = fileNames.indexOf(filename);
  if (index > -1) fileNames.splice(index, 1);
  delete fileTargets[filename];

  fileInput.value = "";

  setTitle(); // recompute after every removal — drops .png if last png is gone
  if (fileNames.length === 0) {
    fileType = null;
    convertButton.disabled = true;
  }

  fetch(`${webroot}/delete`, {
    method: "POST",
    body: JSON.stringify({ filename }),
    headers: { "Content-Type": "application/json" },
  }).catch((err) => console.log(err));

  maybeEnableSubmit();
};
window.deleteRow = deleteRow;

const uploadFile = (file) => {
  convertButton.disabled = true;
  convertButton.textContent = "Uploading...";
  pendingFiles += 1;

  const formData = new FormData();
  formData.append("file", file, file.name);

  const xhr = new XMLHttpRequest();
  xhr.open("POST", `${webroot}/upload`, true);

  xhr.onload = () => {
    pendingFiles -= 1;
    if (pendingFiles === 0) {
      convertButton.textContent = "Convert";
      maybeEnableSubmit();
    }
    const pb = file.htmlRow.getElementsByTagName("progress");
    if (pb[0]) pb[0].parentElement.remove();
  };

  xhr.upload.onprogress = (e) => {
    const pb = file.htmlRow.getElementsByTagName("progress");
    if (pb[0]) pb[0].value = (100 * e.loaded) / e.total;
  };

  xhr.onerror = (e) => console.log(e);
  xhr.send(formData);
};

const formConvert = document.querySelector(`form[action='${webroot}/convert']`);

formConvert.addEventListener("submit", (e) => {
  document.querySelector("input[name='file_names']").value = JSON.stringify(fileNames);
  if (isNewUi()) {
    // attach per-file targets; backend prefers this over convert_to when present
    let hidden = document.querySelector("input[name='file_targets']");
    if (!hidden) {
      hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.name = "file_targets";
      formConvert.appendChild(hidden);
    }
    hidden.value = JSON.stringify(fileTargets);
  }
});

wireClassicPicker();
