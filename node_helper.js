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
        console.log("Starting node_helper for MMM-printerMonitor...");
        this.config = null;
    },

    socketNotificationReceived: function (notification, payload) {
        if (notification === "INIT_OCTOPRINT") {
            this.config = payload;
            if (this.config.debugMode) {
                console.log("Initialized with config:", this.config);
            }
        } else if (notification === "REQUEST_UPDATE") {
            this.fetchPrinterData();
        }
    },

    fetchPrinterData: async function () {
        if (!this.config || !this.config.url || !this.config.api_key) {
            console.error("MMM-printerMonitor: Missing configuration for OctoPrint API.");
            return;
        }

        try {
            // Fetch printer state and job data
            const printerStateUrl = `${this.config.url}/api/printer`;
            const jobStateUrl = `${this.config.url}/api/job`;

            const headers = {
                "X-Api-Key": this.config.api_key,
            };

            // Perform requests in parallel
            const [printerResponse, jobResponse] = await Promise.all([
                axios.get(printerStateUrl, { headers }),
                axios.get(jobStateUrl, { headers }),
            ]);

            const printerData = printerResponse.data;
            const jobData = jobResponse.data;

            // Extract temperatures
            const bedTemp = printerData?.temperature?.bed?.actual || null;
            const bedTarget = printerData?.temperature?.bed?.target || null;
            const toolTemp = printerData?.temperature?.tool0?.actual || null;
            const toolTarget = printerData?.temperature?.tool0?.target || null;

            // Extract printer state
            const printerState = printerData?.state?.text || "Unknown";

            // Extract job information
            const fileName = jobData?.job?.file?.name || "No file";
            const progress = jobData?.progress?.completion || 0;
            const printTimeLeft = jobData?.progress?.printTimeLeft || 0;

            // Build thumbnail URL using PrusaSlicer Thumbnails plugin
            let thumbnail = null;
            if (jobData?.job?.file?.path) {
                const fileName = jobData.job.file.path.replace(/\.gcode$/i, "");
                const encodedFileName = encodeURIComponent(fileName);
                thumbnail = `${this.config.url}/plugin/prusaslicerthumbnails/thumbnail/${encodedFileName}.png`;
            }

            // Combine data
            const payload = {
                printer: {
                    state: printerState,
                    temperature: {
                        bed: { actual: bedTemp, target: bedTarget },
                        tool0: { actual: toolTemp, target: toolTarget },
                    },
                },
                job: {
                    file: { name: fileName },
                    progress: { completion: progress, printTimeLeft: printTimeLeft },
                },
                thumbnail: thumbnail,
            };

            if (this.config.debugMode) {
                console.log("Fetched printer data:", JSON.stringify(payload, null, 2));
            }

            // Send data to the frontend
            this.sendSocketNotification("UPDATE_DATA", payload);
        } catch (error) {
            console.error("MMM-printerMonitor: Error fetching data from OctoPrint API:", error.message);
            this.sendSocketNotification("PRINTER_OFFLINE");
        }
    },
});
