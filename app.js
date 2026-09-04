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

    currentDateElement.textContent =
        now.toLocaleDateString([], {
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

    const [hours, minutes] = time
        .split(":")
        .map(Number);

    return hours * 60 + minutes;
}


function formatTime(date) {

    return date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
    });
}


function formatDuration(milliseconds) {

    const totalMinutes =
        Math.max(0, Math.floor(milliseconds / 60000));

    const hours =
        Math.floor(totalMinutes / 60);

    const minutes =
        totalMinutes % 60;

    return `${hours}h ${minutes
        .toString()
        .padStart(2, "0")}m`;
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

    const [hours, minutes] = checkIn
        .split(":")
        .map(Number);

    const start = new Date();

    start.setHours(
        hours,
        minutes,
        0,
        0
    );

    const durationMinutes =
        timeToMinutes(shiftDuration);

    const end = new Date(
        start.getTime() +
        durationMinutes * 60 * 1000
    );

    return {
        start,
        end
    };
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

        remainingElement.textContent =
            "Check in to start your timer";

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

    const totalDuration =
        end.getTime() - start.getTime();

    const elapsed =
        now.getTime() - start.getTime();

    const remaining =
        end.getTime() - now.getTime();


    /* End time */

    endTimeElement.textContent =
        formatTime(end);


    /* Labels */

    startLabel.textContent =
        formatTime(start);

    endLabel.textContent =
        formatTime(end);


    /* Status */

    status.classList.add("active");
    statusText.textContent = "Checked in";


    /* Remaining time */

    if (remaining > 0) {

        remainingElement.textContent =
            `${formatDuration(remaining)} remaining`;

    } else {

        const overtime =
            Math.abs(remaining);

        remainingElement.textContent =
            `Shift complete • ${formatDuration(overtime)} overtime`;
    }


    /* Progress */

    let percentage =
        (elapsed / totalDuration) * 100;

    percentage =
        Math.min(100, Math.max(0, percentage));

    progressBar.style.width =
        `${percentage}%`;

    progressPercent.textContent =
        `${Math.round(percentage)}%`;
}


/*
|--------------------------------------------------------------------------
| Check In Now
|--------------------------------------------------------------------------
*/

checkInNowButton.addEventListener(
    "click",
    () => {

        const now = new Date();

        const hours =
            now.getHours()
                .toString()
                .padStart(2, "0");

        const minutes =
            now.getMinutes()
                .toString()
                .padStart(2, "0");


        checkInInput.value =
            `${hours}:${minutes}`;


        saveSettings();

        updateTimer();
    }
);


/*
|--------------------------------------------------------------------------
| Save settings
|--------------------------------------------------------------------------
*/

// Replace saveSettings() in app.js
async function saveSettings() {
    const checkIn = checkInInput.value;
    const shiftDuration = shiftDurationInput.value;

    // Save locally as a fallback
    localStorage.setItem("shiftCheckIn", checkIn);
    localStorage.setItem("shiftDuration", shiftDuration);

    // Save to Firestore (assuming document path "shifts/user123")
    if (window.db) {
        try {
            const { doc, setDoc } = window.firestoreTools;
            await setDoc(doc(window.db, "shifts", "user123"), {
                checkIn,
                shiftDuration,
                updatedAt: new Date()
            });
        } catch (error) {
            console.error("Error saving to Firebase:", error);
        }
    }
}


/*
|--------------------------------------------------------------------------
| Load settings
|--------------------------------------------------------------------------
*/

// Listen for changes from Firebase in real-time across devices
function subscribeToShiftData() {
    if (!window.db) return;

    const { doc, onSnapshot } = window.firestoreTools;
    
    onSnapshot(doc(window.db, "shifts", "user123"), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            checkInInput.value = data.checkIn || "";
            shiftDurationInput.value = data.shiftDuration || "08:30";
            updateTimer();
        } else {
            // Fall back to localStorage if document doesn't exist
            loadSettings();
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
        const { doc, setDoc } = window.firestoreTools;
        await setDoc(doc(window.db, "shifts", "user123"), {
            checkIn: "",
            shiftDuration: "08:30"
        });
    }

    updateTimer();
});


/*
|--------------------------------------------------------------------------
| Input changes
|--------------------------------------------------------------------------
*/

checkInInput.addEventListener(
    "change",
    () => {

        saveSettings();
        updateTimer();
    }
);


shiftDurationInput.addEventListener(
    "change",
    () => {

        saveSettings();
        updateTimer();
    }
);


/*
|--------------------------------------------------------------------------
| Initialize
|--------------------------------------------------------------------------
*/

loadSettings();

updateDate();

updateTimer();


/*
|--------------------------------------------------------------------------
| Live timer
|--------------------------------------------------------------------------
*/

setInterval(
    updateTimer,
    1000
);
