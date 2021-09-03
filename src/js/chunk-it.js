/*!
 * @preserve
 *
 * ChunkIT.js
 * Author: Ajay Sharma, @kelter-antunes
 * Project home: https://www.outsystems.com/forge/component-overview/9945/chunk-it
 * Project git: https://github.com/kelter-antunes/Chunk-IT
 *
 * uuidv4 function from https://stackoverflow.com/a/2117523
 */

const uploader = function () {
    function Uploader() {
        this.chunkSize = 1024 * 1024;
        this.threadsQuantity = 2;

        this.file = null;
        this.aborted = false;
        this.uploadedSize = 0;
        this.progressCache = {};
        this.activeConnections = {};

        this.uploadURL = "";
        this.uploadSecret = "";
    }

    Uploader.prototype.setOptions = function(options = {}) {
        this.chunkSize = options.chunkSize;
        this.threadsQuantity = options.threadsQuantity;
        this.uploadURL = options.uploadURL;
        this.uploadSecret = options.uploadSecret;
    }

    Uploader.prototype.setupFile = function(file) {
        if (!file) {
            return;
        }

        this.file = file;
    }

    Uploader.prototype.start = function() {
        if (!this.file) {
            throw new Error("Can't start uploading: file have not chosen");
        }

        const chunksQuantity = Math.ceil(this.file.size / this.chunkSize);
        this.chunksQueue = new Array(chunksQuantity).fill().map((_, index) => index).reverse();

        this.fileId = this.uuidv4();
        this.sendNext();
    }

    Uploader.prototype.sendNext = function() {
        const activeConnections = Object.keys(this.activeConnections).length;

        if (activeConnections >= this.threadsQuantity) {
            return;
        }

        if (!this.chunksQueue.length) {
            if (!activeConnections) {
                this.complete(null,{
            status: "Completed",
            FileId: this.fileId
        });
            }

            return;
        }

        const chunkId = this.chunksQueue.pop();
        const sentSize = chunkId * this.chunkSize;
        const chunk = this.file.slice(sentSize, sentSize + this.chunkSize);

        this.sendChunk(chunk, chunkId)
            .then(() => {
                this.sendNext();
            })
            .catch((error) => {
                this.chunksQueue.push(chunkId);

                this.complete(error);
            });

        this.sendNext();
    }

    Uploader.prototype.complete = function(error,data) {
        if (error && !this.aborted) {
            this.end(error,data);
            return;
        }

       // setTimeout(() => init());

        this.end(error,data);
    }

    Uploader.prototype.sendChunk = function(chunk, id) {
        return new Promise(async (resolve, reject) => {
            try {
                const response = await this.upload(chunk, id);
                const {status, size} = JSON.parse(response);

                if (status !== 200 || size !== chunk.size) {
                    reject(new Error("Failed chunk upload"));
                    return;
                }
            } catch (error) {
                reject(error);
                return;
            }

            resolve();
        })
    }

    Uploader.prototype.handleProgress = function(chunkId, event) {
        if (event.type === "progress" || event.type === "error" || event.type === "abort") {
            this.progressCache[chunkId] = event.loaded;
           
        }

        if (event.type === "loadend") {
            this.uploadedSize += this.progressCache[chunkId] || 0;
            delete this.progressCache[chunkId];
        }
        const inProgress = Object.keys(this.progressCache).reduce((memo, id) => memo += this.progressCache[id], 0);

        const sendedLength = Math.min(this.uploadedSize + inProgress, this.file.size);

        this.onProgress({
            loaded: sendedLength,
            total: this.file.size
        })
        
    }

    Uploader.prototype.upload = function(file, id) {
        return new Promise((resolve, reject) => {
            const xhr = this.activeConnections[id] = new XMLHttpRequest();
            const progressListener = this.handleProgress.bind(this, id);

            xhr.upload.addEventListener("progress", progressListener);

            xhr.addEventListener("error", progressListener);
            xhr.addEventListener("abort", progressListener);
            xhr.addEventListener("loadend", progressListener);

           // xhr.open("post", "/ChunkIT/rest/ProcessChunk/Upload");

            xhr.open("post", this.uploadURL);

            xhr.setRequestHeader("ContentLength", file.size);
            xhr.setRequestHeader("XContentId", this.fileId);
            xhr.setRequestHeader("XChunkId", id);

            xhr.setRequestHeader("XSecret", this.uploadSecret);

            xhr.onreadystatechange = (event) => {
                if (xhr.readyState === 4 && xhr.status === 200) {
                    resolve(xhr.responseText);
                    delete this.activeConnections[id];
                }
            };

            xhr.onerror = (error) => {
                reject(error);
                delete this.activeConnections[id];
            };

            xhr.onabort = () => {
                reject(new Error("Upload canceled by user"));
                delete this.activeConnections[id];
            };
            var reader = new FileReader(); 
            reader.readAsDataURL(file); 
            reader.onloadend = function () { 
            var base64String = reader.result; 
                  xhr.send(base64String.substr(base64String.indexOf(',') + 1));
            } 
          
        })
    }

    Uploader.prototype.on = function(method, callback) {
        if (typeof callback !== "function") {
            callback = () => {};
        }

        this[method] = callback;
    }

    Uploader.prototype.abort = function() {
        Object.keys(this.activeConnections).forEach((id) => {
            this.activeConnections[id].abort();
        });

        this.aborted = true;
    }

    Uploader.prototype.uuidv4 = function () {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
    }

    const multithreadedUploader = new Uploader();

    return {
        options: function (options) {
            multithreadedUploader.setOptions(options);

            return this;
        },
        send: function (file) {
            multithreadedUploader.setupFile(file);

            return this;
        },
        continue: function () {
            multithreadedUploader.sendNext();
        },
        onProgress: function (callback) {
            multithreadedUploader.on("onProgress", callback);

            return this;
        },
        end: function (callback) {
            multithreadedUploader.on("end", callback);
            multithreadedUploader.start();

            return this;
        },
        abort: function () {
            multithreadedUploader.abort();
        }
    }
};