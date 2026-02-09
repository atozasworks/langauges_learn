// Learning Timer Module
class LearningTimer {
    constructor() {
        this.durationMinutes = 30; // Default duration in minutes
        this.remainingSeconds = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.startTime = null;
        this.pausedTime = null;
        this.totalPausedDuration = 0; // Total time spent paused
        this.lastPauseStart = null; // When current pause started
        this.intervalId = null;
        this.onCompleteCallback = null;
    }

    init(durationMinutes) {
        const wasRunning = this.isRunning;
        const wasPaused = this.isPaused;
        
        this.durationMinutes = durationMinutes || 30;
        this.remainingSeconds = this.durationMinutes * 60;
        this.totalPausedDuration = 0;
        this.lastPauseStart = null;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        // If timer was running, restart it with new duration
        if (wasRunning && !wasPaused) {
            this.startTime = Date.now();
            this.startInterval();
        } else if (wasPaused) {
            // If was paused, keep it paused but reset
            this.isRunning = false;
            this.isPaused = false;
        } else {
            this.isRunning = false;
            this.isPaused = false;
            this.startTime = null;
        }
        
        this.updateUI();
    }

    start() {
        if (this.isRunning && !this.isPaused) {
            return; // Already running
        }

        if (this.isPaused) {
            // Resume from paused state
            if (this.lastPauseStart) {
                const pauseDuration = (Date.now() - this.lastPauseStart) / 1000;
                this.totalPausedDuration += pauseDuration;
                this.lastPauseStart = null;
            }
            this.isPaused = false;
        } else {
            // Start fresh
            this.startTime = Date.now();
            this.totalPausedDuration = 0;
            this.lastPauseStart = null;
            this.isRunning = true;
            this.isPaused = false;
        }

        this.updateUI();
        this.startInterval();
    }

    pause() {
        if (!this.isRunning || this.isPaused) {
            return;
        }

        this.isPaused = true;
        this.lastPauseStart = Date.now();
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.updateUI();
    }

    resume() {
        if (!this.isRunning || !this.isPaused) {
            return;
        }

        // Add the current pause duration to total paused time
        if (this.lastPauseStart) {
            const pauseDuration = (Date.now() - this.lastPauseStart) / 1000;
            this.totalPausedDuration += pauseDuration;
            this.lastPauseStart = null;
        }

        this.isPaused = false;
        this.updateUI();
        this.startInterval();
    }

    stop() {
        this.isRunning = false;
        this.isPaused = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.updateUI();
    }

    reset() {
        this.stop();
        this.remainingSeconds = this.durationMinutes * 60;
        this.startTime = null;
        this.pausedTime = null;
        this.totalPausedDuration = 0;
        this.lastPauseStart = null;
        this.updateUI();
    }

    startInterval() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }

        this.intervalId = setInterval(() => {
            this.update();
        }, 100); // Update every 100ms for smooth progress
    }

    update() {
        if (!this.isRunning || this.isPaused) {
            return;
        }

        // Calculate elapsed time, subtracting total paused duration
        const currentTime = Date.now();
        const elapsed = (currentTime - this.startTime) / 1000;
        const actualElapsed = elapsed - this.totalPausedDuration;
        this.remainingSeconds = Math.max(0, (this.durationMinutes * 60) - actualElapsed);

        this.updateUI();

        if (this.remainingSeconds <= 0) {
            this.complete();
        }
    }

    complete() {
        this.stop();
        
        if (this.onCompleteCallback) {
            this.onCompleteCallback();
        }

        // Show completion notification
        if (typeof Utils !== 'undefined') {
            Utils.showToast('Learning session completed!', 'success');
        }
    }

    updateUI() {
        const timerContainer = document.getElementById('timer-container');
        const countdownElement = document.getElementById('timer-countdown');
        const progressBarFill = document.getElementById('progress-bar-fill');
        const pauseBtn = document.getElementById('timer-pause-btn');
        const pauseIcon = pauseBtn?.querySelector('i');
        const durationSelect = document.getElementById('timer-duration-select');

        if (!timerContainer || !countdownElement || !progressBarFill) {
            return;
        }

        // Show timer container when started
        if (this.isRunning || this.isPaused) {
            timerContainer.style.display = 'block';
        }

        // Update countdown display
        const minutes = Math.floor(this.remainingSeconds / 60);
        const seconds = Math.floor(this.remainingSeconds % 60);
        countdownElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        // Update progress bar
        const totalSeconds = this.durationMinutes * 60;
        const progress = Math.max(0, Math.min(100, ((totalSeconds - this.remainingSeconds) / totalSeconds) * 100));
        progressBarFill.style.width = `${progress}%`;

        // Sync duration dropdown
        if (durationSelect) {
            durationSelect.value = this.durationMinutes;
        }

        // Update pause/resume button
        if (pauseBtn && pauseIcon) {
            if (this.isPaused) {
                pauseBtn.title = 'Resume timer';
                pauseBtn.setAttribute('aria-label', 'Resume timer');
                pauseIcon.setAttribute('data-lucide', 'play');
            } else {
                pauseBtn.title = 'Pause timer';
                pauseBtn.setAttribute('aria-label', 'Pause timer');
                pauseIcon.setAttribute('data-lucide', 'pause');
            }
            
            // Reinitialize lucide icons
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    }

    togglePause() {
        if (!this.isRunning) {
            return;
        }

        if (this.isPaused) {
            this.resume();
        } else {
            this.pause();
        }
        
        // Update UI immediately to reflect icon change
        this.updateUI();
    }

    setOnComplete(callback) {
        this.onCompleteCallback = callback;
    }

    getRemainingTime() {
        return this.remainingSeconds;
    }

    getProgress() {
        const totalSeconds = this.durationMinutes * 60;
        return Math.max(0, Math.min(100, ((totalSeconds - this.remainingSeconds) / totalSeconds) * 100));
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LearningTimer;
}

