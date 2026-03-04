// PWA Installation Handler
class PWAInstallHandler {
    constructor() {
        this.deferredPrompt = null;
        this.installPopup = null;
        this.installButton = null;
        this.dismissButton = null;
        this.init();
    }

    init() {
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log('App is already installed');
            return;
        }

        // Setup popup elements first
        this.setupPopupElements();

        // Listen for the beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('beforeinstallprompt event fired');
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later
            this.deferredPrompt = e;
            // Show our custom install popup after a short delay
            setTimeout(() => {
                this.showInstallPopup();
            }, 1000);
        });

        // Listen for app installed event
        window.addEventListener('appinstalled', () => {
            console.log('PWA was installed');
            this.hideInstallPopup();
            this.deferredPrompt = null;
            // Show success message
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast('App installed successfully!', 'success');
            }
        });

        // Check if app is installable after page load (for cases where event already fired)
        window.addEventListener('load', () => {
            setTimeout(() => {
                // If deferredPrompt is already set, show popup
                if (this.deferredPrompt) {
                    this.showInstallPopup();
                }
                // Also check if we can determine installability
                this.checkInstallability();
            }, 2000);
        });
    }

    checkInstallability() {
        // Check if service worker is registered
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then((registration) => {
                if (registration) {
                    console.log('Service worker is registered');
                }
            });
        }

        // Check if manifest exists and app meets PWA criteria
        fetch('./manifest.json')
            .then((response) => {
                if (response.ok) {
                    console.log('Manifest found, checking installability');
                    // If we don't have deferredPrompt yet, but have manifest and SW, 
                    // the browser might show install prompt later
                    // Show our popup as a fallback after delay
                    if (!this.deferredPrompt) {
                        const dismissedTime = localStorage.getItem('pwa-install-dismissed');
                        if (!dismissedTime) {
                            // Wait a bit longer to see if beforeinstallprompt fires
                            setTimeout(() => {
                                // If still no deferredPrompt, show popup anyway
                                // (user can still install via browser menu)
                                if (!this.deferredPrompt) {
                                    console.log('Showing install popup (fallback)');
                                    this.showInstallPopup();
                                }
                            }, 4000);
                        }
                    }
                }
            })
            .catch((error) => {
                console.log('Manifest check failed:', error);
            });
    }

    setupPopupElements() {
        this.installPopup = document.getElementById('pwa-install-popup');
        this.installButton = document.getElementById('pwa-install-btn');
        this.dismissButton = document.getElementById('pwa-dismiss-btn');

        if (this.installButton) {
            this.installButton.addEventListener('click', () => {
                this.installApp();
            });
        }

        if (this.dismissButton) {
            this.dismissButton.addEventListener('click', () => {
                this.hideInstallPopup();
                // Store dismissal in localStorage to not show again for a while
                localStorage.setItem('pwa-install-dismissed', Date.now().toString());
            });
        }

        // Check if user recently dismissed the popup (within 7 days)
        const dismissedTime = localStorage.getItem('pwa-install-dismissed');
        if (dismissedTime) {
            const daysSinceDismissal = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24);
            if (daysSinceDismissal < 7) {
                // Don't show popup if dismissed within last 7 days
                return;
            }
        }
    }

    showInstallPopup() {
        // Don't show if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log('App already installed, not showing popup');
            return;
        }

        // Don't show if recently dismissed
        const dismissedTime = localStorage.getItem('pwa-install-dismissed');
        if (dismissedTime) {
            const daysSinceDismissal = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24);
            if (daysSinceDismissal < 7) {
                console.log('Popup dismissed recently, not showing');
                return;
            }
        }

        if (!this.installPopup) {
            console.log('Install popup element not found');
            return;
        }

        console.log('Showing install popup');
        
        // Show popup using existing utility or direct method
        if (typeof Utils !== 'undefined' && Utils.showPopup) {
            Utils.showPopup('pwa-install-popup');
        } else {
            this.installPopup.style.display = 'flex';
            // Force reflow to ensure display change is applied
            this.installPopup.offsetHeight;
            // Add show class for animation
            this.installPopup.classList.add('show');
        }
        
        // Initialize Lucide icons if available
        if (typeof lucide !== 'undefined') {
            setTimeout(() => {
                lucide.createIcons();
            }, 100);
        }
    }

    hideInstallPopup() {
        if (this.installPopup) {
            if (typeof Utils !== 'undefined' && Utils.hidePopup) {
                Utils.hidePopup('pwa-install-popup');
            } else {
                this.installPopup.style.opacity = '0';
                setTimeout(() => {
                    this.installPopup.classList.remove('show');
                    this.installPopup.style.display = 'none';
                }, 300);
            }
        }
    }

    async installApp() {
        if (!this.deferredPrompt) {
            // If deferredPrompt is not available, show instructions
            this.showInstallInstructions();
            return;
        }

        // Show the install prompt
        this.deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await this.deferredPrompt.userChoice;

        console.log(`User response to the install prompt: ${outcome}`);

        // Clear the deferredPrompt
        this.deferredPrompt = null;

        // Hide the popup
        this.hideInstallPopup();

        if (outcome === 'accepted') {
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast('Installing app...', 'info');
            }
        } else {
            if (typeof Utils !== 'undefined' && Utils.showToast) {
                Utils.showToast('Installation cancelled', 'info');
            }
        }
    }

    showInstallInstructions() {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        const isChrome = /Chrome/.test(navigator.userAgent);
        const isSafari = /Safari/.test(navigator.userAgent) && !isChrome;

        let instructions = '';

        if (isIOS && isSafari) {
            instructions = `
                <p><strong>To install on iOS:</strong></p>
                <ol style="text-align: left; margin: 1rem 0;">
                    <li>Tap the Share button <span style="font-size: 1.2em;">⎋</span> at the bottom</li>
                    <li>Scroll down and tap "Add to Home Screen"</li>
                    <li>Tap "Add" to confirm</li>
                </ol>
            `;
        } else if (isAndroid) {
            instructions = `
                <p><strong>To install on Android:</strong></p>
                <ol style="text-align: left; margin: 1rem 0;">
                    <li>Tap the menu button (three dots) in your browser</li>
                    <li>Select "Add to Home screen" or "Install app"</li>
                    <li>Tap "Install" or "Add" to confirm</li>
                </ol>
            `;
        } else {
            instructions = `
                <p><strong>To install this app:</strong></p>
                <ol style="text-align: left; margin: 1rem 0;">
                    <li>Look for the install icon in your browser's address bar</li>
                    <li>Click it and follow the prompts</li>
                    <li>Or use your browser's menu to "Install app"</li>
                </ol>
            `;
        }

        const message = document.getElementById('pwa-install-message');
        if (message) {
            message.innerHTML = instructions;
        }

        this.showInstallPopup();
    }

    // Check if app is installable
    isInstallable() {
        return this.deferredPrompt !== null;
    }

    // Manually trigger install popup (can be called from UI)
    triggerInstall() {
        if (this.deferredPrompt) {
            this.showInstallPopup();
        } else {
            this.showInstallInstructions();
        }
    }
}

// Initialize PWA Install Handler when DOM is ready
let pwaInstallHandler;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        pwaInstallHandler = new PWAInstallHandler();
    });
} else {
    pwaInstallHandler = new PWAInstallHandler();
}

// Register service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        const swPath = './sw.js';
        navigator.serviceWorker.register(swPath, { updateViaCache: 'none' })
            .then((registration) => {
                console.log('ServiceWorker registration successful:', registration.scope);

                // Check for updates immediately
                registration.update();

                // Periodically check for SW updates (every 60 seconds)
                setInterval(() => {
                    registration.update();
                }, 60 * 1000);

                // Listen for a new SW waiting to activate
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'activated') {
                                // New SW activated — reload to get fresh content
                                console.log('[PWA] New version activated — reloading...');
                                window.location.reload();
                            }
                        });
                    }
                });
            })
            .catch((error) => {
                console.log('ServiceWorker registration failed:', error);
                // Try absolute path as fallback
                navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
                    .then((registration) => {
                        console.log('ServiceWorker registration successful (absolute path):', registration.scope);
                    })
                    .catch((err) => {
                        console.log('ServiceWorker registration failed (both paths):', err);
                    });
            });
    });

    // When a new SW takes over via clients.claim(), reload for fresh content
    let isFirstLoad = true;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!isFirstLoad) {
            console.log('[PWA] Controller changed — reloading for fresh content...');
            window.location.reload();
        }
        isFirstLoad = false;
    });
}

