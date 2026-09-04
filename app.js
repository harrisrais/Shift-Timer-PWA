const checkInInput = document.getElementById("checkIn");
const shiftDurationInput = document.getElementById("shiftDuration");

const checkInNowButton = document.getElementById("checkInNow");
const resetButton = document.getElementById("resetButton");

const endTimeElement = document.getElementById("endTime");
const remainingElement = document.getElementById("remaining");

const currentDateElement = document.getElementById("currentDate");

const startLabel = document.getElementById("startLabel");
const endLabel = document.getElementById("endLabel");

const progressBar = document.getElementById("progressBar");
const progressPercent = document.getElementById("progressPercent");

const status = document.querySelector(".status");
const statusText = document.getElementById("statusText");

/*
|--------------------------------------------------------------------------
| Date
|--------------------------------------------------------------------------
*/

function updateDate() {
    const now = new Date();
    currentDateElement.textContent = now.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric"
    });
}

/*
|--------------------------------------------------------------------------
| Time helpers
|--------------------------------------------------------------------------
*/

function timeToMinutes(time) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
}

function formatTime(date) {
    return date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });
}

function formatDuration(milliseconds) {
    const totalMinutes = Math.max(0, Math.floor(milliseconds / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

/*
|--------------------------------------------------------------------------
| Calculate shift end
|--------------------------------------------------------------------------
*/

function getShiftTimes() {
    const checkIn = checkInInput.value;
    const shiftDuration = shiftDurationInput.value;

    if (!checkIn || !shiftDuration) {
        return null;
    }

    const [hours, minutes] = checkIn.split(":").map(Number);
    const start = new Date();
    start.setHours(hours, minutes, 0, 0);

    const durationMinutes = timeToMinutes(shiftDuration);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    return { start, end };
}

/*
|--------------------------------------------------------------------------
| Update UI
|--------------------------------------------------------------------------
*/

function updateTimer() {
    const times = getShiftTimes();

    if (!times) {
        endTimeElement.textContent = "--:--";
        remainingElement.textContent = "Check in to start your timer";
        startLabel.textContent = "--:--";
        endLabel.textContent = "--:--";
        progressBar.style.width = "0%";
        progressPercent.textContent = "0%";
        status.classList.remove("active");
        statusText.textContent = "Not checked in";
        return;
    }

    const { start, end } = times;
    const now = new Date();
    const totalDuration = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    const remaining = end.getTime() - now.getTime();

    endTimeElement.textContent = formatTime(end);
    startLabel.textContent = formatTime(start);
    endLabel.textContent = formatTime(end);

    status.classList.add("active");
    statusText.textContent = "Checked in";

    if (remaining > 0) {
        remainingElement.textContent = `${formatDuration(remaining)} remaining`;
    } else {
        const overtime = Math.abs(remaining);
        remainingElement.textContent = `Shift complete • ${formatDuration(overtime)} overtime`;
    }

    let percentage = (elapsed / totalDuration) * 100;
    percentage = Math.min(100, Math.max(0, percentage));

    progressBar.style.width = `${percentage}%`;
    progressPercent.textContent = `${Math.round(percentage)}%`;
}

/*
|--------------------------------------------------------------------------
| Check In Now
|--------------------------------------------------------------------------
*/

checkInNowButton.addEventListener("click", () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");

    checkInInput.value = `${hours}:${minutes}`;
    saveSettings();
    updateTimer();
});

/*
|--------------------------------------------------------------------------
| LocalStorage Fallbacks
|--------------------------------------------------------------------------
*/

function saveLocalSettings() {
    localStorage.setItem("shiftCheckIn", checkInInput.value);
    localStorage.setItem("shiftDuration", shiftDurationInput.value);
}

function loadLocalSettings() {
    const savedCheckIn = localStorage.getItem("shiftCheckIn");
    const savedDuration = localStorage.getItem("shiftDuration");

    if (savedCheckIn) checkInInput.value = savedCheckIn;
    if (savedDuration) shiftDurationInput.value = savedDuration;
}

/*
|--------------------------------------------------------------------------
| Firestore Syncing
|--------------------------------------------------------------------------
*/

async function saveSettings() {
    const checkIn = checkInInput.value;
    const shiftDuration = shiftDurationInput.value;

    saveLocalSettings();

    if (window.db) {
        try {
            const { doc, setDoc } = window.firestoreTools;
            await setDoc(doc(window.db, "shifts", "today"), {
                checkIn,
                shiftDuration,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error("Error saving to Firestore:", error);
        }
    }
}

function initFirestoreSync() {
    if (!window.db) return;

    const { doc, onSnapshot } = window.firestoreTools;

    onSnapshot(doc(window.db, "shifts", "today"), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            checkInInput.value = data.checkIn || "";
            shiftDurationInput.value = data.shiftDuration || "08:30";
            saveLocalSettings();
            updateTimer();
        } else {
            loadLocalSettings();
            updateTimer();
        }
    });
}

/*
|--------------------------------------------------------------------------
| Reset
|--------------------------------------------------------------------------
*/

resetButton.addEventListener("click", async () => {
    checkInInput.value = "";
    shiftDurationInput.value = "08:30";

    localStorage.removeItem("shiftCheckIn");
    localStorage.removeItem("shiftDuration");

    if (window.db) {
        try {
            const { doc, setDoc } = window.firestoreTools;
            await setDoc(doc(window.db, "shifts", "today"), {
                checkIn: "",
                shiftDuration: "08:30"
            });
        } catch (error) {
            console.error("Error resetting Firestore document:", error);
        }
    }

    updateTimer();
});

/*
|--------------------------------------------------------------------------
| Event Listeners & Initialization
|--------------------------------------------------------------------------
*/

checkInInput.addEventListener("change", () => {
    saveSettings();
    updateTimer();
});

shiftDurationInput.addEventListener("change", () => {
    saveSettings();
    updateTimer();
});

// Load local state first
loadLocalSettings();
updateDate();
updateTimer();

// Poll briefly to ensure module loaded, then start real-time sync
const dbCheckInterval = setInterval(() => {
    if (window.db) {
        initFirestoreSync();
        clearInterval(dbCheckInterval);
    }
}, 100);

/*
|--------------------------------------------------------------------------
| Live timer
|--------------------------------------------------------------------------
*/

setInterval(updateTimer, 1000);