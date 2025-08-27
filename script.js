
        // Global variables
        let speechSynthesis = window.speechSynthesis;
        let currentUtterance = null;
        let isPaused = false;
        let isSupported = 'speechSynthesis' in window;
        let voicesLoaded = false;
        let debounceTimer = null;

        // DOM elements
        const elements = {
            themeToggle: document.getElementById('themeToggle'),
            themeIcon: document.getElementById('themeIcon'),
            textInput: document.getElementById('textInput'),
            charCounter: document.getElementById('charCounter'),
            languageSelect: document.getElementById('languageSelect'),
            voiceSelect: document.getElementById('voiceSelect'),
            voiceWarning: document.getElementById('voiceWarning'),
            rateSlider: document.getElementById('rateSlider'),
            rateValue: document.getElementById('rateValue'),
            pitchSlider: document.getElementById('pitchSlider'),
            pitchValue: document.getElementById('pitchValue'),
            volumeSlider: document.getElementById('volumeSlider'),
            volumeValue: document.getElementById('volumeValue'),
            playBtn: document.getElementById('playBtn'),
            playIcon: document.getElementById('playIcon'),
            playText: document.getElementById('playText'),
            pauseBtn: document.getElementById('pauseBtn'),
            pauseText: document.getElementById('pauseText'),
            stopBtn: document.getElementById('stopBtn'),
            announcements: document.getElementById('announcements'),
            unsupportedWarning: document.getElementById('unsupportedWarning'),
            presetBtns: document.querySelectorAll('.preset-btn')
        };

        // Initialize the app
        function init() {
            if (!isSupported) {
                elements.unsupportedWarning.style.display = 'block';
                disableControls();
                return;
            }

            loadSettings();
            setupEventListeners();
            loadVoices();
            updateCharCounter();
        }

        // Setup all event listeners
        function setupEventListeners() {
            // Theme toggle
            elements.themeToggle.addEventListener('click', toggleTheme);

            // Text input and character counter
            elements.textInput.addEventListener('input', updateCharCounter);

            // Preset buttons
            elements.presetBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const text = e.target.dataset.text;
                    const lang = e.target.dataset.lang;
                    elements.textInput.value = text;
                    elements.languageSelect.value = lang;
                    updateCharCounter();
                    loadVoices();
                    announce('Sample text loaded');
                });
            });

            // Language change
            elements.languageSelect.addEventListener('change', () => {
                loadVoices();
                saveSettings();
            });

            // Voice change
            elements.voiceSelect.addEventListener('change', saveSettings);

            // Slider controls
            elements.rateSlider.addEventListener('input', (e) => {
                elements.rateValue.textContent = e.target.value;
                saveSettings();
            });

            elements.pitchSlider.addEventListener('input', (e) => {
                elements.pitchValue.textContent = e.target.value;
                saveSettings();
            });

            elements.volumeSlider.addEventListener('input', (e) => {
                elements.volumeValue.textContent = e.target.value;
                saveSettings();
            });

            // Control buttons
            elements.playBtn.addEventListener('click', handlePlay);
            elements.pauseBtn.addEventListener('click', handlePause);
            elements.stopBtn.addEventListener('click', handleStop);

            // Speech synthesis events
            if (speechSynthesis) {
                speechSynthesis.addEventListener('voiceschanged', debounceVoiceLoad);
            }

            // Keyboard shortcuts
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    switch(e.key) {
                        case 'Enter':
                            e.preventDefault();
                            handlePlay();
                            break;
                        case ' ':
                            e.preventDefault();
                            handlePause();
                            break;
                        case 'Escape':
                            e.preventDefault();
                            handleStop();
                            break;
                    }
                }
            });
        }

        // Debounced voice loading to handle multiple voiceschanged events
        function debounceVoiceLoad() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(loadVoices, 100);
        }

        // Load and populate voices
        function loadVoices() {
            if (!speechSynthesis) return;

            const voices = speechSynthesis.getVoices();
            const selectedLang = elements.languageSelect.value;
            
            // Filter voices by selected language
            const filteredVoices = voices.filter(voice => 
                voice.lang.startsWith(selectedLang)
            );

            // Clear current options
            elements.voiceSelect.innerHTML = '';

            if (filteredVoices.length === 0) {
                elements.voiceSelect.innerHTML = '<option value="">No voices available</option>';
                elements.voiceWarning.style.display = 'block';
                announce('No voices available for selected language');
            } else {
                elements.voiceWarning.style.display = 'none';
                
                // Add default option
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'Default Voice';
                elements.voiceSelect.appendChild(defaultOption);

                // Add filtered voices
                filteredVoices.forEach((voice, index) => {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = `${voice.name} (${voice.lang})`;
                    if (voice.default) {
                        option.textContent += ' - Default';
                    }
                    elements.voiceSelect.appendChild(option);
                });
            }

            voicesLoaded = true;
            
            // Restore saved voice selection
            const savedVoice = localStorage.getItem('tts-voice');
            if (savedVoice && elements.voiceSelect.querySelector(`option[value="${savedVoice}"]`)) {
                elements.voiceSelect.value = savedVoice;
            }
        }

        // Handle play button
        function handlePlay() {
            const text = elements.textInput.value.trim();
            
            if (!text) {
                announce('Please enter some text to speak');
                elements.textInput.focus();
                return;
            }

            if (isPaused && currentUtterance) {
                // Resume paused speech
                speechSynthesis.resume();
                isPaused = false;
                updatePlayButton(true);
                elements.pauseBtn.disabled = false;
                announce('Speech resumed');
                return;
            }

            // Stop any current speech
            speechSynthesis.cancel();

            // Create new utterance
            currentUtterance = new SpeechSynthesisUtterance(text);
            
            // Set voice
            const voices = speechSynthesis.getVoices();
            const selectedVoiceIndex = elements.voiceSelect.value;
            const selectedLang = elements.languageSelect.value;
            
            if (selectedVoiceIndex && voices[selectedVoiceIndex]) {
                currentUtterance.voice = voices[selectedVoiceIndex];
            } else {
                // Find default voice for language
                const defaultVoice = voices.find(voice => 
                    voice.lang.startsWith(selectedLang) && voice.default
                ) || voices.find(voice => voice.lang.startsWith(selectedLang));
                
                if (defaultVoice) {
                    currentUtterance.voice = defaultVoice;
                }
            }

            // Set parameters
            currentUtterance.rate = parseFloat(elements.rateSlider.value);
            currentUtterance.pitch = parseFloat(elements.pitchSlider.value);
            currentUtterance.volume = parseFloat(elements.volumeSlider.value);

            // Set event handlers
            currentUtterance.onstart = () => {
                updatePlayButton(true);
                elements.pauseBtn.disabled = false;
                elements.stopBtn.disabled = false;
                announce('Speech started');
            };

            currentUtterance.onend = () => {
                resetButtons();
                announce('Speech completed');
            };

            currentUtterance.onerror = (event) => {
                resetButtons();
                announce(`Speech error: ${event.error}`);
                console.error('Speech synthesis error:', event);
            };

            currentUtterance.onpause = () => {
                isPaused = true;
                updatePlayButton(false);
                elements.pauseBtn.disabled = true;
                announce('Speech paused');
            };

            currentUtterance.onresume = () => {
                isPaused = false;
                updatePlayButton(true);
                elements.pauseBtn.disabled = false;
                announce('Speech resumed');
            };

            // Start speaking
            speechSynthesis.speak(currentUtterance);
        }

        // Handle pause/resume button
        function handlePause() {
            if (!currentUtterance) return;

            if (isPaused) {
                speechSynthesis.resume();
            } else {
                speechSynthesis.pause();
            }
        }

        // Handle stop button
        function handleStop() {
            speechSynthesis.cancel();
            resetButtons();
            announce('Speech stopped');
        }

        // Update play button state
        function updatePlayButton(isSpeaking) {
            if (isSpeaking) {
                elements.playIcon.textContent = '🔊';
                elements.playText.textContent = 'Speaking...';
                elements.playBtn.disabled = true;
            } else {
                elements.playIcon.textContent = '▶️';
                elements.playText.textContent = 'Play';
                elements.playBtn.disabled = false;
            }
        }

        // Reset all buttons to initial state
        function resetButtons() {
            updatePlayButton(false);
            elements.pauseBtn.disabled = true;
            elements.pauseText.textContent = 'Pause';
            elements.stopBtn.disabled = true;
            isPaused = false;
            currentUtterance = null;
        }

        // Update character counter
        function updateCharCounter() {
            const length = elements.textInput.value.length;
            const maxLength = elements.textInput.maxLength;
            elements.charCounter.textContent = `${length} / ${maxLength}`;
            
            // Change color based on usage
            if (length > maxLength * 0.9) {
                elements.charCounter.style.color = 'var(--error)';
            } else if (length > maxLength * 0.7) {
                elements.charCounter.style.color = 'var(--warning)';
            } else {
                elements.charCounter.style.color = 'var(--text-muted)';
            }
        }

        // Theme management
        function toggleTheme() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            document.documentElement.setAttribute('data-theme', newTheme);
            elements.themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
            
            localStorage.setItem('tts-theme', newTheme);
            announce(`Switched to ${newTheme} mode`);
        }

        // Load saved settings
        function loadSettings() {
            // Load theme
            const savedTheme = localStorage.getItem('tts-theme') || 'light';
            document.documentElement.setAttribute('data-theme', savedTheme);
            elements.themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

            // Load other settings
            const savedText = localStorage.getItem('tts-text');
            if (savedText) {
                elements.textInput.value = savedText;
            }

            const savedLang = localStorage.getItem('tts-language');
            if (savedLang) {
                elements.languageSelect.value = savedLang;
            }

            const savedRate = localStorage.getItem('tts-rate');
            if (savedRate) {
                elements.rateSlider.value = savedRate;
                elements.rateValue.textContent = savedRate;
            }

            const savedPitch = localStorage.getItem('tts-pitch');
            if (savedPitch) {
                elements.pitchSlider.value = savedPitch;
                elements.pitchValue.textContent = savedPitch;
            }

            const savedVolume = localStorage.getItem('tts-volume');
            if (savedVolume) {
                elements.volumeSlider.value = savedVolume;
                elements.volumeValue.textContent = savedVolume;
            }
        }

        // Save current settings
        function saveSettings() {
            localStorage.setItem('tts-text', elements.textInput.value);
            localStorage.setItem('tts-language', elements.languageSelect.value);
            localStorage.setItem('tts-voice', elements.voiceSelect.value);
            localStorage.setItem('tts-rate', elements.rateSlider.value);
            localStorage.setItem('tts-pitch', elements.pitchSlider.value);
            localStorage.setItem('tts-volume', elements.volumeSlider.value);
        }

        // Disable controls for unsupported browsers
        function disableControls() {
            const controls = [
                elements.playBtn, elements.pauseBtn, elements.stopBtn,
                elements.voiceSelect, elements.rateSlider, 
                elements.pitchSlider, elements.volumeSlider
            ];
            
            controls.forEach(control => {
                if (control) control.disabled = true;
            });
        }

        // Accessibility announcements
        function announce(message) {
            elements.announcements.textContent = message;
            // Clear after a delay to allow for re-announcements
            setTimeout(() => {
                elements.announcements.textContent = '';
            }, 1000);
        }

        // Auto-save text input
        elements.textInput.addEventListener('input', () => {
            saveSettings();
        });

        // Initialize the application
        document.addEventListener('DOMContentLoaded', init);

        // Handle page visibility changes to pause speech
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && speechSynthesis.speaking && !isPaused) {
                handlePause();
            }
        });
