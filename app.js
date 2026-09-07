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
| User Identity
| Unique per browser/device
|--------------------------------------------------------------------------
*/

function getUserId() {
    let userId = localStorage.getItem("shiftTimer_userId");

    if (!userId) {
        // Generate a random unique ID for this browser/device
        userId =
            "user_" +
            Math.random().toString(36).substring(2, 11) +
            Date.now().toString(36);

        localStorage.setItem("shiftTimer_userId", userId);
    }

    return userId;
}

const currentUserId = getUserId();


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
    const totalMinutes = Math.max(
        0,
        Math.floor(milliseconds / 60000)
    );

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

    const end = new Date(
        start.getTime() + durationMinutes * 60 * 1000
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

    const totalDuration =
        end.getTime() - start.getTime();

    const elapsed =
        now.getTime() - start.getTime();

    const remaining =
        end.getTime() - now.getTime();

    endTimeElement.textContent = formatTime(end);
    startLabel.textContent = formatTime(start);
    endLabel.textContent = formatTime(end);

    status.classList.add("active");
    statusText.textContent = "Checked in";

    if (remaining > 0) {
        remainingElement.textContent =
            `${formatDuration(remaining)} remaining`;
    } else {
        const overtime = Math.abs(remaining);

        remainingElement.textContent =
            `Shift complete • ${formatDuration(overtime)} overtime`;
    }

    let percentage =
        (elapsed / totalDuration) * 100;

    percentage = Math.min(
        100,
        Math.max(0, percentage)
    );

    progressBar.style.width = `${percentage}%`;
    progressPercent.textContent =
        `${Math.round(percentage)}%`;
}


/*
|--------------------------------------------------------------------------
| Check In Now
|--------------------------------------------------------------------------
*/

checkInNowButton.addEventListener("click", () => {
    const now = new Date();

    const hours = now
        .getHours()
        .toString()
        .padStart(2, "0");

    const minutes = now
        .getMinutes()
        .toString()
        .padStart(2, "0");

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
    localStorage.setItem(
        "shiftCheckIn",
        checkInInput.value
    );

    localStorage.setItem(
        "shiftDuration",
        shiftDurationInput.value
    );
}

function loadLocalSettings() {
    const savedCheckIn =
        localStorage.getItem("shiftCheckIn");

    const savedDuration =
        localStorage.getItem("shiftDuration");

    if (savedCheckIn) {
        checkInInput.value = savedCheckIn;
    }

    if (savedDuration) {
        shiftDurationInput.value = savedDuration;
    }
}


/*
|--------------------------------------------------------------------------
| Firestore Syncing
| Each browser/device gets its own document:
|
| shifts/{currentUserId}
|
|--------------------------------------------------------------------------
*/

async function saveSettings() {
    const checkIn = checkInInput.value;
    const shiftDuration = shiftDurationInput.value;

    // Always save locally first
    saveLocalSettings();

    // Then attempt Firestore sync
    if (window.db && window.firestoreTools) {
        try {
            const {
                doc,
                setDoc
            } = window.firestoreTools;

            // IMPORTANT:
            // Each user/device writes to its own document.
            await setDoc(doc(window.db, "shifts", currentUserId), {
            checkIn,
            shiftDuration,
            updatedAt: new Date().toISOString()
            }
        );

            console.log(
                "Settings saved for user:",
                currentUserId
            );

        } catch (error) {
            console.error(
                "Error saving to Firestore:",
                error
            );
        }
    }
}


/*
|--------------------------------------------------------------------------
| Firestore Real-Time Sync
|--------------------------------------------------------------------------
*/

function initFirestoreSync() {
    if (!window.db || !window.firestoreTools) {
        return;
    }

    const {
        doc,
        onSnapshot
    } = window.firestoreTools;

    // Listen ONLY to this browser/device's document
    const userDocument = doc(
        window.db,
        "shifts",
        currentUserId
    );

    onSnapshot(
        userDocument,
        (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();

                checkInInput.value =
                    data.checkIn || "";

                shiftDurationInput.value =
                    data.shiftDuration || "08:30";

                // Keep local storage synchronized
                saveLocalSettings();

                updateTimer();

            } else {
                // No Firestore document yet.
                // Use whatever is stored locally.
                loadLocalSettings();
                updateTimer();
            }
        },
        (error) => {
            console.error(
                "Firestore sync error:",
                error
            );

            // If Firestore is unavailable,
            // continue using LocalStorage.
            loadLocalSettings();
            updateTimer();
        }
    );
}


/*
|--------------------------------------------------------------------------
| Reset
|--------------------------------------------------------------------------
*/

resetButton.addEventListener("click", async () => {
    checkInInput.value = "";
    shiftDurationInput.value = "08:30";

    // Clear local settings
    localStorage.removeItem("shiftCheckIn");
    localStorage.removeItem("shiftDuration");

    // Reset THIS user's Firestore document
    if (window.db && window.firestoreTools) {
        try {
            const {
                doc,
                setDoc
            } = window.firestoreTools;

            await setDoc(doc(window.db, "shifts", currentUserId), {
            checkIn,
            shiftDuration,
            updatedAt: new Date().toISOString()
            }
        );

            console.log(
                "Firestore settings reset for user:",
                currentUserId
            );

        } catch (error) {
            console.error(
                "Error resetting Firestore document:",
                error
            );
        }
    }

    updateTimer();
});


/*
|--------------------------------------------------------------------------
| Event Listeners
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


/*
|--------------------------------------------------------------------------
| Initial Load
|--------------------------------------------------------------------------
*/

// Load local state first.
// This makes the app work even before Firebase loads.
loadLocalSettings();

updateDate();
updateTimer();


/*
|--------------------------------------------------------------------------
| Wait for Firebase
|--------------------------------------------------------------------------
*/

// Firebase is loaded separately, so wait until
// window.db becomes available before starting sync.

const dbCheckInterval = setInterval(() => {
    if (window.db && window.firestoreTools) {
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