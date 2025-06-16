const noteArea = document.getElementById("note");
const modeSelect = document.getElementById("mode");
const createNoteBtn = document.getElementById("create-note-btn");
const notesList = document.getElementById("notes-list");
const openCreateNoteBtn = document.getElementById("open-create-note");
const createNoteIcon = document.getElementById("add-note-btn");

let currentNotes = [];
let selectedNoteIdx = 0;
let currentDomain = "";
let currentTabId = "";  
let urlString = "";
let editMode = false;

function generateRandom9DigitNumber() {
  return Math.floor(100000 + Math.random() * 900000);
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  urlString = tab && tab.url ? tab.url : "chrome://newtab/";
  let url;
  try {
    url = new URL(urlString);
  } catch (e) {
    url = { hostname: "unknown" };
  }
  currentDomain = url.hostname;
  currentTabId = tab && tab.id ? tab.id : "unknown";

  loadNotes();
});

function getKey() {
  if (modeSelect.value === "all") return "notes-tab-all";
  if (modeSelect.value === "domain") return `notes-domain-${currentDomain}`;
  return `notes-tab-${currentTabId}`;
}

function makeNoteObj(text) {
  return {
    id: generateRandom9DigitNumber(),
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    text,
    domain: currentDomain,
    url: urlString
  };
}

// Fetch all notes (criteria 1)
function getAllNotes(callback) {
 chrome.storage.local.get(null, (data) => {
    let allNotes = [];
    let seen = new Set();
    Object.keys(data).forEach(key => {
      if (key.startsWith("notes-domain-") || key.startsWith("notes-tab-")) {
        const notesArr = Array.isArray(data[key]) ? data[key] : [];
        notesArr.forEach(noteObj => {
          // Use noteObj.id if you have unique IDs, or noteObj.text as fallback
          const uniqueKey = noteObj.id || noteObj.text;
          if (
            noteObj &&
            noteObj.text &&
            noteObj.text.trim() !== "" &&
            !seen.has(uniqueKey)
          ) {
            seen.add(uniqueKey);
            allNotes.push({ ...noteObj, _storageKey: key });
          }
        });
      }
    });
    callback(allNotes);
  });
}

// Fetch notes for domain/tab (criteria 2 & 3)
function loadNotes() {
  selectedNoteIdx = -1;
  if (modeSelect.value === "all") {
    // hide the create note button
    openCreateNoteBtn.style.display = "none";
    createNoteIcon.style.display = "none";
      document.getElementById("note-section").style.display = "none";
    getAllNotes((allNotes) => {
      currentNotes = allNotes;
      renderNotes();
      // showNoteSection(false);
    });
  } else {
    openCreateNoteBtn.style.display = "block";
    createNoteIcon.style.display = "block";
     document.getElementById("note-section").style.display = "none";
    noteArea.value = "";
    const key = getKey();
    chrome.storage.local.get(key, (data) => {
      currentNotes = Array.isArray(data[key]) ? data[key] : [];
      renderNotes();
      // showNoteSection(false);
    });
  }
}

function renderNotes() {
  notesList.innerHTML = "";
  if (currentNotes.length === 0) {
    notesList.innerHTML = "<li style='color:#888;padding:8px;'>No notes found.</li>";
    return;
  }
  currentNotes.forEach((noteObj, idx) => {
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.justifyContent = "space-between";
    li.style.paddingRight = "4px";

    const noteText = document.createElement("span");
    noteText.textContent = noteObj.text.length > 30 ? noteObj.text.slice(0, 30) + "..." : noteObj.text;
    noteText.style.cursor = "pointer";
    noteText.className = noteObj.id === selectedNoteIdx ? "selected" : "";
    noteText.onclick = () => selectNote(noteObj.id, idx);

    const btnGroup = document.createElement("span");
    btnGroup.style.display = "flex";
    btnGroup.style.alignItems = "center";

    // Criteria 6: Show open icon if not on the domain/tab of the note
    let shouldShowOpen = false;
    if (modeSelect.value === "all") {
      shouldShowOpen = true;
    } else if (modeSelect.value === "domain" && noteObj.domain !== currentDomain) {
      shouldShowOpen = true;
    } else if (modeSelect.value === "tab" && noteObj.url !== urlString) {
      shouldShowOpen = true;
    }
    if (shouldShowOpen) {
      const openIcon = document.createElement("span");
      openIcon.innerHTML = "🌐";
      openIcon.title = `Open ${noteObj.url}`;
      openIcon.style.cursor = "pointer";
      openIcon.style.marginLeft = "8px";
      openIcon.onclick = (e) => {
        e.stopPropagation();
        chrome.tabs.create({ url: noteObj.url.startsWith("http") ? noteObj.url : "https://" + noteObj.domain });
      };
      btnGroup.appendChild(openIcon);
    }

    // Criteria 4: Delete note
    const deleteBtn = document.createElement("span");
    deleteBtn.innerHTML = "🗑️";
    deleteBtn.title = "Delete note";
    deleteBtn.style.cursor = "pointer";
    deleteBtn.style.marginLeft = "8px";
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteNote(idx);
    };

    btnGroup.appendChild(deleteBtn);

    li.appendChild(noteText);
    li.appendChild(btnGroup);
    notesList.appendChild(li);
  });
}

function selectNote(id, notePositionInList) {
  editMode = true;
  console.log("selectNote called with idx:", id);
   console.log("selectNote called with position in list:", notePositionInList);
  console.log("this got here for select note")
  console.log("currentNotes:", currentNotes);
  console.log("currentNotes:", currentNotes.filter(note => note.id === id)[0]);
  selectedNoteIdx = notePositionInList;
  noteArea.value = currentNotes.filter(note => note.id === id)[0].text || "";
  showNoteSection(true, true);
}

function showNoteSection(show, edit) {
  document.getElementById("note-section").style.display = show ? "block" : "none";
  document.getElementById("open-create-note").style.display = show ? "none" : "block";
  if (!edit) {
     noteArea.value = "";
     return;
  }
  noteArea.readOnly = !edit;
  if (edit) {
    noteArea.focus();
  } else {
    noteArea.blur();
  }
  noteArea.style.height = "auto"; // Reset height

}

// Update saveCurrentNote to remove empty notes
function saveCurrentNote() {
  const noteText = noteArea.value.trim();
  if (noteText === "") {
      console.warn("Note is empty, not saving.");
    return;
  }

  currentNotes[selectedNoteIdx].text = noteText;
  chrome.storage.local.set({ [getKey()]: currentNotes }, () => {
    renderNotes();
  });
}

function deleteNote(idx) {
  currentNotes.splice(idx, 1);
  if (currentNotes.length === 0) {
    selectedNoteIdx = -1;
    chrome.storage.local.set({ [getKey()]: currentNotes }, renderNotes);
    // showNoteSection(false);
    return;
  }
  if (selectedNoteIdx >= currentNotes.length) {
    selectedNoteIdx = currentNotes.length - 1;
  }
  chrome.storage.local.set({ [getKey()]: currentNotes }, () => {
    renderNotes();
    // selectNote(selectedNoteIdx);
  });
}

// Criteria 5: Create note
createNoteBtn.addEventListener("click", () => {
   if(editMode) {
      saveCurrentNote();
   } else {
     //prevent creating a note if the text area is empty
      const noteText = noteArea.value.trim();
      if (noteText === "") {
          console.warn("Note is empty, not saving.");
        return;
      }
      // Only add a new note if the user will type something
      currentNotes.push(makeNoteObj(noteText));
      selectedNoteIdx = currentNotes.length - 1;
      chrome.storage.local.set({ [getKey()]: currentNotes }, () => {
        renderNotes();
        // selectNote(selectedNoteIdx);
        noteArea.readOnly = false;
        noteArea.focus();
      });
   }
});

openCreateNoteBtn.addEventListener("click", () => {
  editMode = false;
   showNoteSection(true, false);
});

createNoteIcon.addEventListener("click", () => {
   editMode = false;
   showNoteSection(true, false);
});

modeSelect.addEventListener("change", loadNotes);

noteArea.addEventListener("blur", saveCurrentNote);