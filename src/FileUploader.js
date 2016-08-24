/**
 * FileUploader.js
 *
 * Copyright 2015, Moxiecode Systems AB
 * Released under GPL License.
 *
 * License: http://www.plupload.com/license
 * Contributing: http://www.plupload.com/contributing
 */

/**
 * @class plupload/FileUploader
 * @constructor 
 * @since 3.0
 * @final
 * @extends plupload/core/Queueable
 */
define('plupload/FileUploader', [
	'plupload',
	'plupload/core/Collection',
	'plupload/core/Queueable',
	'plupload/ChunkUploader'
], function(plupload, Collection, Queueable, ChunkUploader) {


	function FileUploader(fileRef, queue) {
		var _file = fileRef;
		var _offset = 0;
		var _chunks = new Collection();
		var _uid = plupload.guid();

		Queueable.call(this);

		this._options = {
			url: false,
			chunk_size: 0,
			multipart: true,
			http_method: 'POST',
			params: {},
			headers: false,
			file_data_name: 'file',
			send_file_name: true,
			stop_on_fail: true
		};

		plupload.extend(this, {
			/**
			 * For backward compatibility
			 *
			 * @property id
			 * @type {String}
			 * @deprecated
			 */
			id: _uid,

			/**
			Unique identifier

			@property uid
			@type {String}
            */
			uid: _uid,

			/**
			When send_file_name is set to true, will be sent with the request as `name` param. 
            Can be used on server-side to override original file name.

            @property name
			@type {String}
            */
			name: _file.name,

			/**
			@property target_name
			@type {String}
			@deprecated use name
            */
			target_name: null,

			/**
			 * File type, `e.g image/jpeg`
			 *
			 * @property type
			 * @type String
			 */
			type: _file.type,

			/**
			 * File size in bytes (may change after client-side manupilation).
			 *
			 * @property size
			 * @type Number
			 */
			size: _file.size,

			/**
			 * Original file size in bytes.
			 *
			 * @property origSize
			 * @type Number
			 */
			origSize: _file.size,


			start: function(options) {
				var self = this;
				var up;

				this.setOptions(options);

				FileUploader.prototype.start.call(self);

				// send additional 'name' parameter only if required or explicitly requested
				if (self._options.send_file_name) {
					self._options.params.name = self.target_name || self.name;
				}

				if (self._options.chunk_size) {
					self.uploadChunk(false, false, true);
				} else {
					up = new ChunkUploader(_file, self._options);

					up.bind('progress', function(e) {
						self.progress(e.loaded, e.total);
					});

					up.bind('done', function(e, result) {
						self.done(result);
					});

					up.bind('failed', function(e, result) {
						self.failed(result);
					});

					_queue.addItem(up);
				}
			},

			/**
			 * Get the file for which this FileUploader is responsible
			 *
			 * @method getSource
			 * @deprecated use getFile()
			 * @returns {moxie.file.File}
			 */
			getSource: function() {
				return this.getFile();
			},

			/**
			 * Returns file representation of the current runtime. For HTML5 runtime
			 * this is going to be native browser File object
			 * (for backward compatibility)
			 *
			 * @method getNative
			 * @deprecated
			 * @returns {File|Blob|Object}
			 */
			getNative: function() {
				return this.getFile().getSource();
			},

			/**
			 * Get the file for which this FileUploader is responsible
			 *
			 * @method getFile
			 * @returns {moxie.file.File}
			 */
			getFile: function() {
				return fileRef;
			},


			uploadChunk: function(seq, options, dontStop) {
				var self = this;
				var chunkSize;
				var up;
				var chunk;
				var _options = this._options;

				if (options) {
					// chunk_size cannot be changed on the fly
					delete options.chunk_size;
					plupload.extend(_options, options);
				}

				chunk.seq = parseInt(seq, 10) || Math.floor(_offset / chunkSize) + 1; // advance by one if undefined,
				chunk.start = chunk.seq * chunkSize;
				chunk.end = Math.max(chunk.start + chunkSize, _file.size);
				chunk.total = _file.size;

				// do not proceed for weird chunks
				if (chunk.start < 0 || chunk.start >= _file.size) {
					return false;
				}


				up = ChunkUploader(_file.slice(chunk.start, chunk.end, _file.type), _options);

				up.bind('progress', function(e) {
					self.progress(calcProcessed() + e.processed, e.total);
				});

				up.bind('failed', function(e, result) {
					_chunks.add(chunk.seq, plupload.extend({
						state: Queueable.FAILED
					}, chunk));

					self.trigger('chunkuploadfailed', plupload.extend({}, chunk, result));

					if (_options.stop_on_fail) {
						self.failed(result);
					}
				});

				up.bind('done', function(e, result) {
					_chunks.add(chunk.seq, plupload.extend({
						state: Queueable.DONE
					}, chunk));

					self.trigger('chunkuploaded', plupload.extend({}, chunk, result));

					if (calcProcessed() >= _file.size) {
						self.done(result); // obviously we are done
					} else if (dontStop) {
						plupload.delay.call(self, self.uploadChunk);
					}

					this.destroy();
				});

				up.bind('failed', function(e, result) {
					self.progress(calcProcessed());
					this.destroy();
				});


				_chunks.add(chunk.seq, plupload.extend({
					state: Queueable.PROCESSING
				}, chunk));
				queue.addItem(up);

				// enqueue even more chunks if slots available
				if (dontStop && queue.countSpareSlots()) {
					self.uploadChunk();
				}

				return true;
			},


			setOption: function(option, value) {
				if (typeof(option) !== 'object' && !this._options.hasOwnProperty(option)) {
					return;
				}
				FileUploader.prototype.setOption.apply(this, arguments);
			},


			destroy: function() {
				FileUploader.prototype.destroy.call(this);
				queue = _file = null;
			}
		});


		function calcProcessed() {
			var processed = 0;

			_chunks.each(function(item) {
				if (item.state === Queueable.DONE) {
					processed += (item.end - item.start);
				}
			});

			return processed;
		}

	}


	FileUploader.prototype = new Queueable();

	// for backward compatibility
	plupload.File = FileUploader; // have an alias

	return FileUploader;
});