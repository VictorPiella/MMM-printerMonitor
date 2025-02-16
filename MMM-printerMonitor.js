Module.register("MMM-printerMonitor", {
    defaults: {
        url: "", // OctoPrint server URL
        api_key: "", // OctoPrint API key
        showStream: true, // Enable video stream
        streamUrl: "", // Webcam stream URL (dynamically set if not provided)
        showPreview: true, // Enable preview video
        previewUrl: "", // Preview video URL
        maxStreamWidth: 400, // Max width for the stream
        maxStreamHeight: 300, // Max height for the stream
        showTemps: true, // Show temperature data
        updateInterval: 60 * 1000, // Update interval in milliseconds
        debugMode: false, // Enable debug logs
        hideModuleWhenOffline: false, // Hide the module when the printer is offline
    },

    start: function () {
        this.printerData = null;
        this.cameraAvailable = true;

        if (!this.config.streamUrl && this.config.url) {
            this.config.streamUrl = `${this.config.url}/webcam/?action=stream`;
        }

        if (this.config.debugMode) {
            console.log("Starting MMM-printerMonitor with config:", this.config);
        }

        this.sendSocketNotification("INIT_OCTOPRINT", this.config);

        setInterval(() => {
            this.checkCameraStatus();
            this.sendSocketNotification("REQUEST_UPDATE");
        }, this.config.updateInterval);
    },

    checkCameraStatus: function () {
        if (this.config.streamUrl) {
            fetch(this.config.streamUrl, { method: "HEAD" })
                .then((response) => {
                    this.cameraAvailable = response.ok;
                    this.updateDom();
                })
                .catch(() => {
                    this.cameraAvailable = false;
                    this.updateDom();
                });
        } else {
            this.cameraAvailable = false;
            this.updateDom();
        }
    },

    getDom: function () {
        const wrapper = document.createElement("div");
        wrapper.className = "MMM-printerMonitor";

        const imagesDiv = document.createElement("div");
        imagesDiv.className = "images";

        const thumbnailWrapper = document.createElement("div");
        thumbnailWrapper.className = "thumbnail";

        const thumbnail = document.createElement("img");
        if (this.printerData?.thumbnail) {
            thumbnail.src = this.printerData.thumbnail;
            thumbnail.alt = "3D Printer Thumbnail";
        }

        thumbnail.style.maxWidth = this.config.maxStreamWidth + "px";
        thumbnail.style.maxHeight = this.config.maxStreamHeight + "px";
        thumbnailWrapper.appendChild(thumbnail);
        imagesDiv.appendChild(thumbnailWrapper);

        if (this.config.showStream) {
            const streamWrapper = document.createElement("div");
            streamWrapper.className = "stream";

            const stream = document.createElement("img");
            stream.src = this.cameraAvailable ? this.config.streamUrl : this.getFile("stream.gif");
            stream.alt = "3D Printer Stream";
            stream.style.maxWidth = this.config.maxStreamWidth + "px";
            stream.style.maxHeight = this.config.maxStreamHeight + "px";
            streamWrapper.appendChild(stream);
            imagesDiv.appendChild(streamWrapper);
        }

        wrapper.appendChild(imagesDiv);

        const infoDiv = document.createElement("div");
        infoDiv.className = "info";

        const printerState = this.printerData?.printer?.state || "No status";
        const fileName = this.printerData?.job?.file?.name || "No file name";
        const progress = this.printerData?.job?.progress?.completion
            ? `${this.printerData.job.progress.completion.toFixed(0)}%`
            : "N/A";
        const remainingTime = this.printerData?.job?.progress?.printTimeLeft
            ? this.formatTime(this.printerData.job.progress.printTimeLeft)
            : "N/A";
        const bedTemp = this.printerData?.printer?.temperature?.bed?.actual.toFixed(0) || "N/A";
        const toolTemp = this.printerData?.printer?.temperature?.tool0?.actual.toFixed(0) || "N/A";

        infoDiv.innerHTML = `
            <div>
                <div id="printerState">${printerState}</div>
                <div id="progress">${progress}</div>
                <div id="remainingTime"><span class="mdi mdi-clock-time-eight-outline"></span> ${remainingTime}</div>
                <div id="fileName">${fileName}</div>
            </div>
            <div id="temp">
                <div id="bed">
                    <span class="mdi mdi-printer-3d"></span>
                    ${bedTemp} ºC
                </div>
                <div id="tool">
                    <span class="mdi mdi-printer-3d-nozzle"></span>
                    ${toolTemp} ºC
                </div>
            </div>
        `;

        wrapper.appendChild(infoDiv);
        return wrapper;
    },

    formatTime: function (seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, "0")}:${minutes
            .toString()
            .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    },

    socketNotificationReceived: function (notification, payload) {
        if (notification === "UPDATE_DATA") {
            if (this.config.debugMode) {
                console.log("Received Printer Data:", payload);
            }
            this.printerData = payload;

            if (this.config.hideModuleWhenOffline) {
                this.show();
            }
            this.updateDom();
        } else if (notification === "PRINTER_OFFLINE") {
            if (this.config.debugMode) {
                console.log("Printer is offline. Hiding module.");
            }
            if (this.config.hideModuleWhenOffline) {
                this.hide();
            }
        }
    },

    getStyles: function () {
        return ["MMM-printerMonitor.css"];
    },

    getFile: function (file) {
        return this.file(file);
    },

    show: function () {
        const moduleWrapper = document.getElementById(this.identifier);
        if (moduleWrapper) {
            moduleWrapper.classList.remove("hidden");
        }
    },

    hide: function () {
        const moduleWrapper = document.getElementById(this.identifier);
        if (moduleWrapper) {
            moduleWrapper.classList.add("hidden");
        }
    },
});
