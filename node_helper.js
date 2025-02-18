/* Magic Mirror
 * Node Helper: MMM-printerMonitor
 *
 * By Victor Piella
 * MIT Licensed.
 */
const NodeHelper = require("node_helper");
const axios = require("axios");

module.exports = NodeHelper.create({
    start: function () {
		this.config = {}; // Initialize an empty config object
		this.isPrinterOnline = false; // Track printer status

		console.log("[MMM-printerMonitor] Node helper started");
	},

    socketNotificationReceived: function (notification, payload) {
		if (notification === "INIT_OCTOPRINT") {
			this.config = payload || {}; // Ensure it's never undefined

			if (!this.config.streamUrl && this.config.url) {
				this.config.streamUrl = `${this.config.url}/webcam/?action=stream`;
			}

			if (this.config.debugMode) {
				console.log("[MMM-printerMonitor] Config received:", this.config);
			}

			this.fetchPrinterData(); // Fetch data immediately
			setInterval(() => {
				this.fetchPrinterData();
			}, this.config.updateInterval);
		}
	},


    fetchPrinterData: async function () {
        if (!this.config || !this.config.url || !this.config.api_key) {
            console.error("[MMM-printerMonitor] Missing configuration for OctoPrint API.");
            return;
        }

        try {
            const printerStateUrl = `${this.config.url}/api/printer`;
            const jobStateUrl = `${this.config.url}/api/job`;

            const headers = { "X-Api-Key": this.config.api_key };

            // Perform both API requests in parallel
            const [printerResponse, jobResponse] = await Promise.all([
                axios.get(printerStateUrl, { headers }),
                axios.get(jobStateUrl, { headers }),
            ]);

            const printerData = printerResponse.data;
            const jobData = jobResponse.data;

            // Extract printer state & temperatures
            const printerState = printerData?.state?.text || "Unknown";
            const bedTemp = printerData?.temperature?.bed?.actual || null;
            const toolTemp = printerData?.temperature?.tool0?.actual || null;

            // Extract job progress
            const fileName = jobData?.job?.file?.name || "No file";
            const progress = jobData?.progress?.completion || 0;
            const printTimeLeft = jobData?.progress?.printTimeLeft || 0;

            // Build thumbnail URL for PrusaSlicer Thumbnails plugin
            let thumbnail = null;
            if (jobData?.job?.file?.path) {
                const fileBaseName = jobData.job.file.path.replace(/\.gcode$/i, "");
                const encodedFileName = encodeURIComponent(fileBaseName);
                thumbnail = `${this.config.url}/plugin/prusaslicerthumbnails/thumbnail/${encodedFileName}.png`;
            }

            // Prepare payload
            const payload = {
                printer: {
                    state: printerState,
                    temperature: {
                        bed: { actual: bedTemp },
                        tool0: { actual: toolTemp },
                    },
                },
                job: {
                    file: { name: fileName },
                    progress: { completion: progress, printTimeLeft: printTimeLeft },
                },
                thumbnail: thumbnail,
            };

            if (this.config.debugMode) {
                console.log("[MMM-printerMonitor] Printer data fetched:", JSON.stringify(payload, null, 2));
            }

            // Determine if the printer is online
            const isOnline = printerState !== "Offline";
            if (isOnline !== this.isPrinterOnline) {
                this.isPrinterOnline = isOnline;
                this.sendSocketNotification(isOnline ? "UPDATE_DATA" : "PRINTER_OFFLINE", payload);
            } else {
                this.sendSocketNotification("UPDATE_DATA", payload);
            }
        } catch (error) {
            console.error("[MMM-printerMonitor] Error fetching data from OctoPrint API:", error.message);
            this.isPrinterOnline = false;
            this.sendSocketNotification("PRINTER_OFFLINE");
        }
    },
});
