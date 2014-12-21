/*! punchdrunk 0.0.4 (2014-12-21) - https://github.com/TannerRogalsky/punchdrunk */
/*! An attempt to replicate the Love API in JavaScript */
/*! Tanner Rogalsky *//*
 * Moonshine - a Lua virtual machine.
 *
 * Copyright (C) 2013 Gamesys Limited,
 * 10 Piccadilly, London W1J 0DD
 * Email: moonshine@gamesys.co.uk
 * http://moonshinejs.org
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */




// vm/src/gc.js:



'use strict';


var shine = shine || {};


/**
 * Constant empty object for use in comparisons, etc to avoid creating an object needlessly
 * @type Object
 * @constant
 */
shine.EMPTY_OBJ = {};


/**
 * Constant empty array for use in comparisons, etc to avoid creating an object needlessly
 * @type Object
 * @constant
 */
shine.EMPTY_ARR = [];




/**
 * Moonshine GC functions.
 * @namespace
 */
shine.gc = {


	/**
	 * Collected objects, empty and ready for reuse.
	 * @type Array
	 * @static
	 */
	objects: [],


	/**
	 * Collected objects, empty and ready for reuse.
	 * @type Array
	 * @static
	 */
	arrays: [],


	/**
	 * Number of objects and array that have been collected. Use for debugging.
	 * @type Number
	 * @static
	 */
	collected: 0,


	/**
	 * Number of objects and array that have been reused. Use for debugging.
	 * @type Number
	 * @static
	 */
	reused: 0,




	/**
	 * Prepare an array for reuse.
	 * @param {Array} arr Array to be used.
	 */
	cacheArray: function (arr) {
		arr.length = 0;
		this.arrays.push(arr);
		this.collected++;
	},




	/**
	 * Prepare an object for reuse.
	 * @param {Object} obj Object to be used.
	 */
	cacheObject: function (obj) {
		for (var i in obj) if (obj.hasOwnProperty(i)) delete obj[i];
		this.objects.push(obj);
		this.collected++;
	},




	/**
	 * Returns a clean array from the cache or creates a new one if cache is empty.
	 * @returns {Array} An empty array.
	 */
	createArray: function () {
		if (this.arrays.length) this.reused++;
		return this.arrays.pop() || [];
	},




	/**
	 * Returns a clean object from the cache or creates a new one if cache is empty.
	 * @returns {Object} An empty object.
	 */
	createObject: function () {
		if (this.objects.length) this.reused++;
		return this.objects.pop() || {};
	},




	/**
	 * Reduces the number of references associated with an object by one and collect it if necessary.
	 * @param {Object} Any object.
	 */
	decrRef: function (val) {
		if (!val || !(val instanceof shine.Table) || val.__shine.refCount === undefined) return;
		if (--val.__shine.refCount == 0) this.collect(val);
	},




	/**
	 * Increases the number of references associated with an object by one.
	 * @param {Object} Any object.
	 */
	incrRef: function (val) {
		if (!val || !(val instanceof shine.Table) || val.__shine.refCount === undefined) return;
		val.__shine.refCount++;
	},




	/**
	 * Collect an object.
	 * @param {Object} Any object.
	 */
	collect: function (val) {
		if (val === undefined || val === null) return;
		if (val instanceof Array) return this.cacheArray(val);
		if (typeof val == 'object' && val.constructor == Object) return this.cacheObject(val);

		if (!(val instanceof shine.Table) || val.__shine.refCount === undefined) return;

		var i, l,
			meta = val.__shine;

		for (i = 0, l = meta.keys.length; i < l; i++) this.decrRef(meta.keys[i]);
		for (i = 0, l = meta.values.length; i < l; i++) this.decrRef(meta.values[i]);
		for (i = 0, l = meta.numValues.length; i < l; i++) this.decrRef(meta.numValues[i]);

		this.cacheArray(meta.keys);
		this.cacheArray(meta.values);

		delete meta.keys;
		delete meta.values;

		this.cacheObject(meta);
		delete val.__shine;

		for (i in val) if (val.hasOwnProperty(i)) this.decrRef(val[i]);
	}


};





// vm/src/EventEmitter.js:



'use strict';


var shine = shine || {};


/**
 * Abstract object that fires events.
 * @constructor
 */
shine.EventEmitter = function () {
	this._listeners = {};
};




/**
 * Triggers an event.
 * @param {string} name Name of the event.
 * @param {Array} [data = []] Array containing any associated data.
 */
shine.EventEmitter.prototype._trigger = function (name, data) {
	var listeners = this._listeners[name],
		result,
		i;

	if (!listeners) return;
	if (!((data || shine.EMPTY_OBJ) instanceof Array)) data = [data];

	for (i in listeners) {
		if (listeners.hasOwnProperty(i)) {
			result = listeners[i].apply(this, data);
			if (result !== undefined && !result) break;
		}
	}
};




/**
 * Adds an event listener.
 * @param {string} name Name of the event.
 * @param {Function} Callback Listener function.
 */
shine.EventEmitter.prototype.on = function (name, callback) {
	if (!this._listeners[name]) this._listeners[name] = [];
	this._listeners[name].push(callback);
}




/**
 * Removes an event listener.
 * @param {string} name Name of the event.
 * @param {Function} Callback Listener function to be removed.
 */
shine.EventEmitter.prototype.unbind = function (name, callback) {
	for (var i in this._listeners[name]) {
		if (this._listeners[name].hasOwnProperty(i) && this._listeners[name][i] === callback) this._listeners[name].splice(i, 1);
	}
}




if (typeof module == 'object' && module.exports) module.exports.EventEmitter = shine.EventEmitter;





// vm/src/FileManager.js:



'use strict';


var shine = shine || {};


/**
 * Handles loading packages and distilled scripts.
 * @constructor
 * @extends shine.EventEmitter
 */
shine.FileManager = function () {
	shine.EventEmitter.call(this);
	this._cache = {};
};


shine.FileManager.prototype = new shine.EventEmitter();
shine.FileManager.prototype.constructor = shine.FileManager;




/**
 * Loads a file or package.
 * @param {String|Object} url Url of distilled json file or luac byte code file, or the json or byte code itself, or an object tree.
 * @param {Function} callback Load successful callback.
 */
shine.FileManager.prototype.load = function (url, callback) {
	var me = this,
		data;


	function parse (data, url) {
		var tree;

		if (me.constructor._isJson(data)) {
			// JSON
			tree = JSON.parse(data);

		} else if (me.constructor._isLuac(data)) {
			// Raw Lua 5.1 byte code
			tree = me.constructor._parseLuac(data);
		}

		if (tree) {
			window.setTimeout(function () {		// Make sure all calls are async.
				if (url) me._cache[url] = tree;
				me._onSuccess(url || '', tree, callback);
			}, 1);
		}

		return !!tree;
	}


	function success (data) {
		if (!parse(data, url)) throw new Error('File contains non-parsable content: ' + url);
	}


	function error (code) {
		me._onError(code, callback);
	}


	switch (typeof url) {
		case 'string':

			if (!parse(url)) {
				// If not parseable, treat as filename
				if (data = this._cache[url]) {
					window.setTimeout(function () { me._onSuccess(url, data, callback); }, 1);
				} else {
					shine.utils.get(url, success, error);
				}
			}

			break;


		case 'object':
			this._onSuccess('', url, callback);
			break;


		default:
			throw new TypeError('Can\'t load object of unknown type');
	}
};




/**
 * Handles a successful response from the server.
 * @param {String} data Response.
 */
shine.FileManager.prototype._onSuccess = function (url, data, callback) {
	var file, i;

	if (data.format == 'moonshine.package') {
		for (i in data.files) this._cache[i] = data.files[i];
		this._trigger('loaded-package', data);

		if (!(url = data.main)) return;
		if (!(data = data.files[url])) throw new ReferenceError("The package's main reference does not point to a filename within the package");
	}

	file = new shine.File(url, data);

	this._onFileLoaded(file, function () {
		callback(null, file);
	});
};




/**
 * Hook called when a distilled file is loaded successfully. Overridden by debug engine.
 * @param {String} data Response.
 */
shine.FileManager.prototype._onFileLoaded = function (file, callback) {
	callback();
};




/**
 * Handles an unsuccessful response from the server. Overridden by debug engine.
 * @param {Number} code HTTP resonse code.
 */
shine.FileManager.prototype._onError = function (code, callback) {
	callback(code);
};




/**
 * Checks if a value represents a JSON string.
 * @param {String} val String to be checked.
 * @returns {Boolean} Is a JSON string?
 */
shine.FileManager._isJson = function (val) {
	return /^({.*}|\[.*\])$/.test(val);
};




/**
 * Checks if a value represents a Lua 5.1 byte code.
 * @param {String} val String to be checked.
 * @returns {Boolean} Is byte code?
 */
shine.FileManager._isLuac = function (val) {
	return val.substr(0, 5) == String.fromCharCode(27, 76, 117, 97, 81);
};




/**
 * Parses a string containing valid Lua 5.1 byte code into a tree.
 * Note: Requires Moonshine Distillery and could return unexpected results if ArrayBuffer is not supported.
 * @param {String} data Byte code string.
 * @returns {Object} Tree repesenting the Lua script.
 * @throws {Error} If Moonshine's distillery is not available.
 */
shine.FileManager._parseLuac = function (data) {
	if (!shine.distillery) throw new Error('Moonshine needs the distillery to parse Lua byte code. Please include "distillery.moonshine.js" in the page.');
	if (!('ArrayBuffer' in window)) console.warn('Browser does not support ArrayBuffers, this could cause unexpected results when loading binary files.');
	return new shine.distillery.Parser().parse(data);
};




/**
 * Dump memory associated with FileManager.
 */
shine.FileManager.prototype.dispose = function () {
	delete this._cache;
};





// vm/src/VM.js:



'use strict';


var shine = shine || {};


/**
 * A Lua virtual machine.
 * @constructor
 * @extends shine.EventEmitter
 * @param {object} env Object containing global variables and methods from the host.
 */
shine.VM = function (env) {
	shine.EventEmitter.call(this);

	// this._files = [];
	// this._packagedFiles = {};
	this.fileManager = new shine.FileManager();
	this._env = env || {};
	this._coroutineStack = [];

	this._status = shine.RUNNING;
	this._resumeStack = [];
	this._callbackQueue = [];
	this._coroutineStack = [];

	this._resetGlobals();
};

shine.VM.prototype = new shine.EventEmitter();
shine.VM.prototype.constructor = shine.VM;


shine.RUNNING = 0;
shine.SUSPENDING = 1;
shine.SUSPENDED = 2;
shine.RESUMING = 3;
shine.DEAD = 4;




/**
 * Resets all global variables to their original values.
 */
shine.VM.prototype._resetGlobals = function () {
	var arg = new shine.Table();
	arg.setMember(-1, 'moonshine');

	this._globals = this._bindLib(shine.lib);
	this._globals.arg = arg;

	// Load standard lib into package.loaded:
	for (var i in this._globals) if (this._globals.hasOwnProperty(i) && this._globals[i] instanceof shine.Table) this._globals['package'].loaded[i] = this._globals[i];
	this._globals['package'].loaded._G = this._globals;

	// Load environment vars
	for (var i in this._env) if (this._env.hasOwnProperty(i)) this._globals[i] = this._env[i];
};




/**
 * Returns a copy of an object, with all functions bound to the VM. (recursive)
 */
shine.VM.prototype._bindLib = function (lib) {
	var result = shine.gc.createObject();

	for (var i in lib) {
		if (lib.hasOwnProperty(i)) {

			// if (lib[i] && lib[i].constructor === shine.Table) {
			// 	result[i] = lib[i];//new shine.Table(shine.utils.toObject(lib[i]));

			// } else if (lib[i] && lib[i].constructor === Object) {
			// 	result[i] = this._bindLib(lib[i]);

			// } else if (typeof lib[i] == 'function') {
			// 	result[i] = (function (func, context) {
			// 		return function () { return func.apply(context, arguments); };
			// 	})(lib[i], this);

			// } else {
				result[i] = lib[i];
			// }
		}
	}

	return new shine.Table(result);
};




/**
 * Loads a file containing compiled Luac code, decompiled to JSON.
 * @param {string} url The url of the file to load.
 * @param {boolean} [execute = true] Whether or not to execute the file once loaded.
 * @param {object} [coConfig] Coroutine configuration. Only applicable if execute == true.
 */
shine.VM.prototype.load = function (url, execute, coConfig) {
	var me = this;

	this.fileManager.load(url, function (err, file) {
		if (err) throw new URIError('Failed to load file: ' + url + ' (' + err + ')');

		me._trigger('file-loaded', file);
		if (execute || execute === undefined) me.execute(coConfig, file);
	});
};




/**
 * Executes the loaded Luac data.
 * @param {object} [coConfig] Coroutine configuration.
 * @param {shine.File} [file] A specific file to execute. If not present, executes all files in the order loaded.
 */
shine.VM.prototype.execute = function (coConfig, file) {
	var me = this,
		files = file? [file] : this._files,
		index,
		file,
		thread;


	if (!files.length) throw new Error ('No files loaded.');

	for (index in files) {
		if (files.hasOwnProperty(index)) {

			file = files[index];
			if (!file.data) throw new Error('Tried to execute file before data loaded.');


			thread = this._thread = new shine.Function(this, file, file.data, this._globals);
			this._trigger('executing', [thread, coConfig]);

			try {
				if (!coConfig) {
					thread.call ();

				} else {
					var co = shine.lib.coroutine.wrap.call(this, thread),
						resume = function () {
							co();
							if (coConfig.uiOnly && co._coroutine.status != shine.DEAD) window.setTimeout(resume, 1);
						};

					resume();
				}

			} catch (e) {
				shine.Error.catchExecutionError(e);
			}
		}
	}
};




/**
 * Creates or updates a global in the guest environment.
 * @param {String} name Name of the global variable.
 * @param {Object} value Value.
 */
shine.VM.prototype.setGlobal = function (name, value) {
	this._globals[name] = value;
};




/**
 * Retrieves a global from the guest environment.
 * @param {String} name Name of the global variable.
 * @returns {Object} Value of the global variable.
 */
shine.VM.prototype.getGlobal = function (name) {
	return this._globals[name];
};




/**
 * Suspends any execution in the VM.
 */
shine.VM.prototype.suspend = function () {
	if (this._status !== shine.RUNNING) throw new Error('attempt to suspend a non-running VM');

	var vm = this;

	this._status = shine.SUSPENDING;
	this._resumeVars = undefined;

	window.setTimeout(function () {
		if (vm._status == shine.SUSPENDING) vm._status = shine.SUSPENDED;
	}, 1);
};




/**
 * Resumes execution in the VM from the point at which it was suspended.
 */
shine.VM.prototype.resume = function (retvals) {
	if (this._status !== shine.SUSPENDED && this._status !== shine.SUSPENDING) throw new Error('attempt to resume a non-suspended VM');

	if (!arguments.length || retvals !== undefined) retvals = retvals || this._resumeVars;

	if (retvals && !(retvals instanceof Array)) {
		var arr = shine.gc.createArray();
		arr.push(retvals);
		retvals = arr;
	}

	this._status = shine.RESUMING;
	this._resumeVars = retvals;

	var f = this._resumeStack.pop();

	if (f) {
		try {
			if (f instanceof shine.Coroutine) {
				f.resume();
			} else if (f instanceof shine.Closure) {
				f._run();
			} else {
				f();
			}

		} catch (e) {
			if (!((e || shine.EMPTY_OBJ) instanceof shine.Error)) {
				var stack = (e.stack || '');

				e = new shine.Error ('Error in host call: ' + e.message);
				e.stack = stack;
				e.luaStack = stack.split ('\n');
			}

			if (!e.luaStack) e.luaStack = shine.gc.createArray();
			e.luaStack.push([f, f._pc - 1]);

			shine.Error.catchExecutionError(e);
		}
	}

	if (this._status == shine.RUNNING) {
		while (this._callbackQueue[0]) this._callbackQueue.shift()();
	}
};




/**
 * Dumps memory associated with the VM.
 */
shine.VM.prototype.dispose = function () {
	var thread;

	for (var i in this._files) if (this._files.hasOwnProperty(i)) this._files[i].dispose();

	if (thread = this._thread) thread.dispose();

	delete this._files;
	delete this._thread;
	delete this._globals;
	delete this._env;
	delete this._coroutineStack;

	this.fileManager.dispose();
	delete this.fileManager;


	// Clear static stacks -- Very dangerous for environments that contain multiple VMs!
	shine.Closure._graveyard.length = 0;
	shine.Closure._current = undefined;
	shine.Coroutine._graveyard.length = 0;
};




/**
 * Returns a reference to the VM that is currently executing.
 * @returns {shine.VM} Current VM
 */
shine.getCurrentVM = function () {
	var closure;
	return (closure = this.Closure._current) && closure._vm;
};



// vm/src/Register.js:



'use strict';


var shine = shine || {};


/**
 * Represents a register.
 * @constructor
 */
shine.Register = function () {
	this._items = shine.gc.createArray();
};


/**
 * Array of disposed registers, ready to be reused.
 * @type Array
 * @static
 */
shine.Register._graveyard = [];




/**
 * Returns a new, empty register.
 * @returns {shine.Register} An empty register
 */
shine.Register.create = function () {
	var o = shine.Register._graveyard.pop();
	return o || new shine.Register(arguments);
};




/**
 * Returns the number of items in the register.
 * @returns {Number} Number of items.
 */
shine.Register.prototype.getLength = function () {
	return this._items.length;
};




/**
 * Retrieves an item from the register.
 * @param {Number} index Index of the item.
 * @returns {Object} Value of the item.
 */
shine.Register.prototype.getItem = function (index) {
	return this._items[index];
};




/**
 * Sets the value an item in the register.
 * @param {Number} index Index of the item.
 * @param {Object} value Value of the item.
 */
shine.Register.prototype.setItem = function (index, value) {
	var item = this._items[index];

	shine.gc.incrRef(value);
	shine.gc.decrRef(item);

	this._items[index] = value;
};




/**
 * Rewrites the values of all the items in the register.
 * @param {Array} arr The entire register.
 */
shine.Register.prototype.set = function (arr) {
	var i,
		l = Math.max(arr.length, this._items.length);

	for (i = 0; i < l; i++) this.setItem(i, arr[i]);
};




/**
 * Inserts new items at the end of the register.
 * @param {...Object} One or more items to be inserted.
 */
shine.Register.prototype.push = function () {
	this._items.push.apply(this._items, arguments);
};




/**
 * Removes an item from the register.
 * @param {Number} index Index of the item to remove.
 */
shine.Register.prototype.clearItem = function (index) {
	delete this._items[index];
};




/**
 * Splices the register.
 * @param {Number} index Index of the first item to remove.
 * @param {Number} length Number of items to remove.
 * @param {...Object} One or more items to be inserted.
 */
shine.Register.prototype.splice = function (index, length) {
	this._items.splice.apply(this._items, arguments);
};




/**
 * Empties the register.
 */
shine.Register.prototype.reset = function () {
	for (var i = 0, l = this._items.length; i < l; i++) shine.gc.decrRef(this._items[i]);
	this._items.length = 0;
};




/**
 * Cleans up the register and caches it for reuse.
 */
shine.Register.prototype.dispose = function () {
	this._items.reset();
	this.constructor._graveyard.push(this);
};





// vm/src/Closure.js:



'use strict';


var shine = shine || {};


/**
 * Represents an instance of a function and its related closure.
 * @constructor
 * @extends shine.EventEmitter
 * @param {shine.File} file The file in which the function is declared.
 * @param {object} data Object containing the Luac data for the function.
 * @param {object} globals The global variables for the environment in which the function is declared.
 * @param {object} [upvalues] The upvalues passed from the parent closure.
 */
shine.Closure = function (vm, file, data, globals, upvalues) {
	var me = this;

	this._vm = vm;
	this._globals = globals;
	this._file = file;
	this._data = data;

	this._upvalues = upvalues || shine.gc.createObject();
	this._constants = data.constants;
	this._functions = data.functions;
	this._instructions = data.instructions;

	this._register = this._register || shine.Register.create();
	this._pc = 0;
	this._localsUsedAsUpvalues = this._localsUsedAsUpvalues || shine.gc.createArray();
	this._funcInstances = this._funcInstances || shine.gc.createArray();
	this._localFunctions = shine.gc.createObject();

	var me = this,
		result = function () {
			var args = shine.gc.createArray();
			for (var i = 0, l = arguments.length; i < l; i++) args.push(arguments[i]);
			return me.execute(args);
		};

	result._instance = this;

	result.dispose = function () {
		me.dispose.apply(me, arguments);
		delete this.dispose;
	};

	return result;
};


shine.Closure.prototype = {};
shine.Closure.prototype.constructor = shine.Closure;

shine.Closure._graveyard = [];
shine.Closure._current = undefined;




shine.Closure.create = function (vm, file, data, globals, upvalues) {
	var instance = shine.Closure._graveyard.pop();
	//console.log(instance? 'reusing' : 'creating');

	if (instance) {
		return shine.Closure.apply(instance, arguments);
	} else {
		return new shine.Closure(vm, file, data, globals, upvalues);
	}
};




/**
 * Starts execution of the function instance from the beginning.
 * @param {Array} args Array containing arguments to use.
 * @returns {Array} Array of return values.
 */
shine.Closure.prototype.execute = function (args) {
	var me = this;

	if (this._vm._status != shine.RUNNING) {
		this._vm._callbackQueue.push(function () {
			me.execute.call(me, args);
		});

		return;
	}


	this._pc = 0;

	//if (this._data && this._data.sourceName) shine.stddebug.write('Executing ' + this._data.sourceName + '...'); //? ' ' + this._data.sourceName : ' function') + '...<br><br>');
	//shine.stddebug.write('\n');

	// ASSUMPTION: Parameter values are automatically copied to R(0) onwards of the function on initialisation. This is based on observation and is neither confirmed nor denied in any documentation. (Different rules apply to v5.0-style VARARG functions)
	this._params = shine.gc.createArray().concat(args);
	this._register.set(args.splice(0, this._data.paramCount));

	if (this._data.is_vararg == 7) {	// v5.0 compatibility (LUA_COMPAT_VARARG)
		var arg = shine.gc.createArray().concat(args),
			length = arg.length;

		arg = new shine.Table(arg);
		arg.setMember('n', length);

		this._register.push(arg);
	}

	try {
		return this._run();

	} catch (e) {
		if (!((e || shine.EMPTY_OBJ) instanceof shine.Error)) {
			var stack = (e.stack || '');

			e = new shine.Error('Error in host call: ' + e.message);
			e.stack = stack;
			e.luaStack = stack.split('\n');
		}

		if (!e.luaStack) e.luaStack = shine.gc.createArray();
		e.luaStack.push([this, this._pc - 1]);

		throw e;
	}
};




/**
 * Continues execution of the function instance from its current position.
 * @returns {Array} Array of return values.
 */
shine.Closure.prototype._run = function () {
	var instruction,
		line,
		retval,
		yieldVars,
		running;

	this.terminated = false;


	if (this._vm._status == shine.RESUMING) {
	 	if (this._vm._resumeStack.length) {
			this._pc--;

		} else {
			this._vm._status = shine.RUNNING;

			yieldVars = this._vm._resumeVars;
			delete this._vm._resumeVars;
		}

	} else if (shine.debug && shine.debug._status == shine.RESUMING) {
	 	if (shine.debug._resumeStack.length) {
			this._pc--;

		} else {
			shine.debug._setStatus(shine.RUNNING);
		}

	} else if ((running = this._vm._coroutineRunning) && running.status == shine.RESUMING) {
	 	if (running._resumeStack.length) {
			this._pc--;

		} else {
			running.status = shine.RUNNING;
			//shine.stddebug.write('[coroutine resumed]\n');

			yieldVars = running._yieldVars;
		}
	}


	if (yieldVars) {
		// instruction = this._instructions[this._pc - 1];

		var offset = (this._pc - 1) * 4,
			a = this._instructions[offset + 1],
			b = this._instructions[offset + 2],
			c = this._instructions[offset + 3],
			retvals = shine.gc.createArray();

		for (var i = 0, l = yieldVars.length; i < l; i++) retvals.push(yieldVars[i]);

		if (c === 0) {
			l = retvals.length;

			for (i = 0; i < l; i++) {
				this._register.setItem(a + i, retvals[i]);
			}

			this._register.splice(a + l);

		} else {
			for (i = 0; i < c - 1; i++) {
				this._register.setItem(a + i, retvals[i]);
			}
		}

		shine.gc.collect(retvals);
	}


	while (this._instructions[this._pc * 4] !== undefined) {
		line = this._data.linePositions && this._data.linePositions[this._pc];
		retval = this._executeInstruction(this._pc++, line);

		if ((running = this._vm._coroutineRunning) && running.status == shine.SUSPENDING) {
			running._resumeStack.push(this);

			if (running._func._instance == this) {
				retval = running._yieldVars;

				running.status = shine.SUSPENDED;
				shine.Coroutine._remove();

				//shine.stddebug.write('[coroutine suspended]\n');

				return retval;
			}

			return;
		}

		if (this._vm._status == shine.SUSPENDING && !retval) {
			this._vm._resumeStack.push(this);
			return;
		}

		if (shine.debug && shine.debug._status == shine.SUSPENDING && !retval) {
			shine.debug._resumeStack.push(this);
			return;
		}


		if (retval !== undefined) {
			this.terminated = true;
			this.dispose();

			return retval;
		}
	}

	this.terminated = true;
	this.dispose();
};




/**
 * Executes a single instruction.
 * @param {object} instruction Information about the instruction.
 * @param {number} line The line number on which to find the instruction (for debugging).
 * @returns {Array} Array of the values that make be returned from executing the instruction.
 */
shine.Closure.prototype._executeInstruction = function (pc, line) {
	this.constructor._current = this;

	var offset = pc * 4,
		opcode = this._instructions[offset],
		op = this.constructor.OPERATIONS[opcode],
		A = this._instructions[offset + 1],
		B = this._instructions[offset + 2],
		C = this._instructions[offset + 3];

	// if (!op) throw new Error('Operation not implemented! (' + opcode + ')');
	return op.call(this, A, B, C);
};




/**
 * Returns the value of the constant registered at a given index.
 * @param {number} index Array containing arguments to use.
 * @returns {object} Value of the constant.
 */
shine.Closure.prototype._getConstant = function (index) {
	if (this._constants[index] === null) return;
	return this._constants[index];
};





/**
 * Returns whether or not the closure has retained child scopes.
 * @returns {boolean} Has retained child scopes.
 */
shine.Closure.prototype.hasRetainedScope = function () {

	if (this._localsUsedAsUpvalues.length) return true;
	if (this._upvalues.length) return true;

	// for (var i in this._upvalues) {
	// 	if (this._funcInstances.hasOwnProperty(i) && this._upvalues[i].open) return true;
	// }

	for (var i in this._funcInstances) {
		if (this._funcInstances.hasOwnProperty(i) && this._funcInstances[i].isRetained()) return true;
	}

	return false;
};





/**
 * Dump memory associtated with closure.
 */
shine.Closure.prototype.dispose = function (force) {

	if (force || !this.hasRetainedScope()) {
		delete this._vm;
		delete this._globals;
		delete this._file;
		delete this._data;

		delete this._functions;
		delete this._instructions;

		delete this._pc;
		// delete this._funcInstances;

		shine.gc.collect(this._params);
		shine.gc.collect(this._localFunctions);

		delete this._params;

		delete this._constants;

//		delete this._localsUsedAsUpvalues;
		delete this._upvalues;

		this._register.reset();
		this._funcInstances.length = 0;
		this._localsUsedAsUpvalues.length = 0;

		shine.Closure._graveyard.push(this);
	}

};






// Operation handlers:
// Note: The Closure instance is passed in as the "this" object for these handlers.
(function () {


	function move (a, b) {
		var val = this._register.getItem(b),
			local,
			i;

		this._register.setItem(a, val);

		if (this._data.locals && val && val instanceof shine.Function) {
			for (i = this._data.locals.length - 1; i >= 0; i--) {
				local = this._data.locals[i];
				if (local.startpc == this._pc - 1) this._localFunctions[local.varname] = val;
			}
		}
	}




	function loadk (a, bx) {
		this._register.setItem(a, this._getConstant(bx));
	}




	function loadbool (a, b, c) {
		this._register.setItem(a, !!b);
		if (c) this._pc++;
	}




	function loadnil (a, b) {
		for (var i = a; i <= b; i++) this._register.setItem(i, undefined);
	}




	function getupval (a, b) {
		if (this._upvalues[b] === undefined) return;
		this._register.setItem(a, this._upvalues[b].getValue());
	}




	function getglobal (a, b) {
		var result;

		if (this._getConstant(b) == '_G') {	// Special case
			result = this._globals; //new shine.Table(this._globals);

		} else if (this._globals[this._getConstant(b)] !== undefined) {
			result = this._globals[this._getConstant(b)];
		}

		this._register.setItem(a, result);
	}




	function gettable (a, b, c) {
		var result,
			local,
			i;

		b = this._register.getItem(b);
		c = (c >= 256)? this._getConstant(c - 256) : this._register.getItem(c);

		if (b === undefined) throw new shine.Error('Attempt to index a nil value (' + c + ' not present in nil)');

		if (b instanceof shine.Table) {
			result = b.getMember(c);

		} else if (typeof b == 'string' && shine.lib.string[c]) {
			result = shine.lib.string[c];

		} else {
			result = b[c];
		}

		this._register.setItem(a, result);

		if (result && result instanceof shine.Function) this._localFunctions[c] = result;
	}




	function setglobal(a, b) {
		var varName = this._getConstant(b),
			oldValue = this._globals[varName],
			newValue = this._register.getItem(a);

		shine.gc.incrRef(newValue);
		shine.gc.decrRef(oldValue);

		this._globals[varName] = newValue;
	}




	function setupval (a, b) {
		this._upvalues[b].setValue (this._register.getItem(a));
	}




	function settable (a, b, c) {
		a = this._register.getItem(a);
		b = (b >= 256)? this._getConstant(b - 256) : this._register.getItem(b);
		c = (c >= 256)? this._getConstant(c - 256) : this._register.getItem(c);

		if (a === undefined) throw new shine.Error('Attempt to index a missing field (can\'t set "' + b + '" on a nil value)');

		if (a instanceof shine.Table) {
			a.setMember(b, c);

		} else {
			a[b] = c;
		}
	}




	function newtable (a, b, c) {
		var t = new shine.Table();
		t.__shine.refCount = 0;
		this._register.setItem(a, t);
	}




	function self (a, b, c) {
		var result;
		b = this._register.getItem(b);
		c = (c >= 256)? this._getConstant(c - 256) : this._register.getItem(c);

		this._register.setItem(a + 1, b);

		if (b === undefined) throw new shine.Error('Attempt to index a nil value (' + c + ' not present in nil)');

		if (b instanceof shine.Table) {
			result = b.getMember(c);

		} else if (typeof b == 'string' && shine.lib.string[c]) {
			result = shine.lib.string[c];

		} else {
			result = b[c];
		}

		this._register.setItem(a, result);
	}




	function add (a, b, c) {
		//TODO: Extract the following RK(x) logic into a separate method.
		b = (b >= 256)? this._getConstant(b - 256) : this._register.getItem(b);
		c = (c >= 256)? this._getConstant(c - 256) : this._register.getItem(c);

		var coerce = shine.utils.coerce,
			mt, f, bn, cn;

		if (((b || shine.EMPTY_OBJ) instanceof shine.Table && (mt = b.__shine.metatable) && (f = mt.getMember('__add')))
		|| ((c || shine.EMPTY_OBJ) instanceof shine.Table && (mt = c.__shine.metatable) && (f = mt.getMember('__add')))) {
			this._register.setItem(a, f.apply(null, [b, c], true)[0]);

		} else {
			b = coerce(b, 'number', 'attempt to perform arithmetic on a %type value');
			c = coerce(c, 'number', 'attempt to perform arithmetic on a %type value');
			this._register.setItem(a, b + c);
		}
	}




	function sub (a, b, c) {
		b = (b >= 256)? this._getConstant(b - 256) : this._register.getItem(b);
		c = (c >= 256)? this._getConstant(c - 256) : this._register.getItem(c);

		var coerce = shine.utils.coerce,
			mt, f;

		if (((b || shine.EMPTY_OBJ) instanceof shine.Table && (mt = b.__shine.metatable) && (f = mt.getMember('__sub')))
		|| ((c || shine.EMPTY_OBJ) instanceof shine.Table && (mt = c.__shine.metatable) && (f = mt.getMember('__sub')))) {
			this._register.setItem(a, f.apply(null, [b, c], true)[0]);

		} else {
			b = coerce(b, 'number', 'attempt to perform arithmetic on a %type value');
			c = coerce(c, 'number', 'attempt to perform arithmetic on a %type value');
			this._register.setItem(a, b - c);
		}
	}




	function mul (a, b, c) {
		b = (b >= 256)? this._getConstant(b - 256) : this._register.getItem(b);
		c = (c >= 256)? this._getConstant(c - 256) : this._register.getItem(c);

		var coerce = shine.utils.coerce,
			mt, f;

		if (((b || shine.EMPTY_OBJ) instanceof shine.Table && (mt = b.__shine.metatable) && (f = mt.getMember('__mul')))
		|| ((c || shine.EMPTY_OBJ) instanceof shine.Table && (mt = c.__shine.metatable) && (f = mt.getMember('__mul')))) {
			this._register.setItem(a, f.apply(null, [b, c], true)[0]);

		} else {
			b = coerce(b, 'number', 'attempt to perform arithmetic on a %type value');
			c = coerce(c, 'number', 'attempt to perform arithmetic on a %type value');
			this._register.setItem(a, b * c);
		}
	}




	function div (a, b, c) {
		b = (b >= 256)? this._getConstant(b - 256) : this._register.getItem(b);
		c = (c >= 256)? this._getConstant(c - 256) : this._register.getItem(c);

		var coerce = shine.utils.coerce,
			mt, f;

		if (((b || shine.EMPTY_OBJ) instanceof shine.Table && (mt = b.__shine.metatable) && (f = mt.getMember('__div')))
		|| ((c || shine.EMPTY_OBJ) instanceof shine.Table && (mt = c.__shine.metatable) && (f = mt.getMember('__div')))) {
			this._register.setItem(a, f.apply(null, [b, c], true)[0]);

		} else {
			b = coerce(b, 'number', 'attempt to perform arithmetic on a %type value');
			c = coerce(c, 'number', 'attempt to perform arithmetic on a %type value');
			this._register.setItem(a, b / c);
		}
	}




	function mod (a, b, c) {
		b = (b >= 256)? this._getConstant(b - 256) : this._register.getItem(b);
		c = (c >= 256)? this._getConstant(c - 256) : this._register.getItem(c);

		var coerce = shine.utils.coerce,
			mt, f, result, absC;

		if (((b || shine.EMPTY_OBJ) instanceof shine.Table && (mt = b.__shine.metatable) && (f = mt.getMember('__mod')))
		|| ((c || shine.EMPTY_OBJ) instanceof shine.Table && (mt = c.__shine.metatable) && (f = mt.getMember('__mod')))) {
			this._register.setItem(a, f.apply(null, [b, c], true)[0]);

		} else {
			b = coerce(b, 'number', 'attempt to perform arithmetic on a %type value');
			c = coerce(c, 'number', 'attempt to perform arithmetic on a %type value');

			if (c === 0 || c === -Infinity || c === Infinity || window.isNaN(b) || window.isNaN(c)) {
				result = NaN;

			} else {
				// result = b - Math.floor(b / c) * c; // Working, but slower on some devices.

				result = Math.abs(b) % (absC = Math.abs(c));
                if (b * c < 0) result = absC - result;
                if (c < 0) result *= -1;
			}

			this._register.setItem(a, result);
		}
	}




	function pow (a, b, c) {
		b = (b >= 256)? this._getConstant(b - 256) : this._register.getItem(b);
		c = (c >= 256)? this._getConstant(c - 256) : this._register.getItem(c);

		var coerce = shine.utils.coerce,
			mt, f;

		if (((b || shine.EMPTY_OBJ) instanceof shine.Table && (mt = b.__shine.metatable) && (f = mt.getMember('__pow')))
		|| ((c || shine.EMPTY_OBJ) instanceof shine.Table && (mt = c.__shine.metatable) && (f = mt.getMember('__pow')))) {
			this._register.setItem(a, f.apply(null, [b, c], true)[0]);

		} else {
			b = coerce(b, 'number', 'attempt to perform arithmetic on a %type value');
			c = coerce(c, 'number', 'attempt to perform arithmetic on a %type value');
			this._register.setItem(a, Math.pow(b, c));
		}
	}




	function unm (a, b) {
		var mt, f, result;

		b = this._register.getItem(b);

		if ((b || shine.EMPTY_OBJ) instanceof shine.Table && (mt = b.__shine.metatable) && (f = mt.getMember('__unm'))) {
			result = shine.gc.createArray();
			result.push(b);
			result = f.apply(null, [b], true)[0];

		} else {
			b = shine.utils.coerce(b, 'number', 'attempt to perform arithmetic on a %type value');
			result = -b;
		}

		this._register.setItem(a, result);
	}




	function not (a, b) {
		this._register.setItem(a, !this._register.getItem(b));
	}




	function len (a, b) {
		var length,
			i;

		b = this._register.getItem(b);

		if ((b || shine.EMPTY_OBJ) instanceof shine.Table) {
			length = shine.lib.table.getn(b);

		} else if (typeof b == 'object') {
			length = 0;
			for (i in b) if (b.hasOwnProperty(i)) length++;

		} else if (b == undefined) {
			throw new shine.Error('attempt to get length of a nil value');

		} else {
			length = b.length;
		}

		this._register.setItem(a, length);
	}




	function concat (a, b, c) {

		var text = this._register.getItem(c),
			i, item, mt, f, args;

		for (i = c - 1; i >= b; i--) {
			item = this._register.getItem(i);

			if ((item !== undefined && item instanceof shine.Table && (mt = item.__shine.metatable) && (f = mt.getMember('__concat')))
			|| (text !== undefined && text instanceof shine.Table && (mt = text.__shine.metatable) && (f = mt.getMember('__concat')))) {
				args = shine.gc.createArray();
				args.push(item, text);

				text = f.apply(null, args, true)[0];

			} else {
				if (!(typeof item === 'string' || typeof item === 'number') || !(typeof text === 'string' || typeof text === 'number')) throw new shine.Error('Attempt to concatenate a non-string or non-numeric value');
				text = item + text;
			}
		}

		this._register.setItem(a, text);
	}




	function jmp (a, sbx) {
		this._pc += sbx;
	}




	function eq (a, b, c) {
		b = (b >= 256)? this._getConstant(b - 256) : this._register.getItem(b);
		c = (c >= 256)? this._getConstant(c - 256) : this._register.getItem(c);

		var mtb, mtc, f, result;

		if (b !== c && (b || shine.EMPTY_OBJ) instanceof shine.Table && (c || shine.EMPTY_OBJ) instanceof shine.Table && (mtb = b.__shine.metatable) && (mtc = c.__shine.metatable) && mtb === mtc && (f = mtb.getMember('__eq'))) {
			result = !!f.apply(null, [b, c], true)[0];
		} else {
			result = (b === c);
		}

		if (result != a) this._pc++;
	}




	function lt (a, b, c) {
		b = (b >= 256)? this._getConstant(b - 256) : this._register.getItem(b);
		c = (c >= 256)? this._getConstant(c - 256) : this._register.getItem(c);

		var typeB = (typeof b != 'object' && typeof b) || ((b || shine.EMPTY_OBJ) instanceof shine.Table && 'table') || 'userdata',
			typeC = (typeof c != 'object' && typeof b) || ((c || shine.EMPTY_OBJ) instanceof shine.Table && 'table') || 'userdata',
			f, result, mtb, mtc;

		if (typeB !== typeC) {
			throw new shine.Error ('attempt to compare ' + typeB + ' with ' + typeC);

		} else if (typeB == 'table') {
			if ((mtb = b.__shine.metatable) && (mtc = c.__shine.metatable) && mtb === mtc && (f = mtb.getMember('__lt'))) {
				result = f.apply(null, [b, c], true)[0];
			} else {
				throw new shine.Error('attempt to compare two table values');
			}

		} else {
			result = (b < c);
		}

		if (result != a) this._pc++;
	}




	function le (a, b, c) {
		b = (b >= 256)? this._getConstant(b - 256) : this._register.getItem(b);
		c = (c >= 256)? this._getConstant(c - 256) : this._register.getItem(c);

		var typeB = (typeof b != 'object' && typeof b) || ((b || shine.EMPTY_OBJ) instanceof shine.Table && 'table') || 'userdata',
			typeC = (typeof c != 'object' && typeof b) || ((c || shine.EMPTY_OBJ) instanceof shine.Table && 'table') || 'userdata',
			f, result, mtb, mtc;

		if (typeB !== typeC) {
			throw new shine.Error('attempt to compare ' + typeB + ' with ' + typeC);

		} else if (typeB == 'table') {
			if ((mtb = b.__shine.metatable) && (mtc = c.__shine.metatable) && mtb === mtc && (f = mtb.getMember('__le'))) {
				result = f.apply(null, [b, c], true)[0];
			} else {
				throw new shine.Error('attempt to compare two table values');
			}

		} else {
			result = (b <= c);
		}

		if (result != a) this._pc++;
	}




	function test (a, b, c) {
		a = this._register.getItem(a);
		if (shine.utils.coerce(a, 'boolean') !== !!c) this._pc++;
	}




	function testset (a, b, c) {
		b = this._register.getItem(b);

		if (shine.utils.coerce(b, 'boolean') === !!c) {
			this._register.setItem(a, b);
		} else {
			this._pc++;
		}
	}




	function call (a, b, c) {

		var args = shine.gc.createArray(),
			i, l,
			retvals,
			funcToResume,
			running,
			f, o, mt;


		if (this._vm._status == shine.RESUMING) {
			// If we're resuming from the VM being suspended.
			funcToResume = this._vm._resumeStack.pop();

		} else if (shine.debug && shine.debug._status == shine.RESUMING) {
			// If we're resuming from a breakpoint/stepping, resume call stack first.
			funcToResume = shine.debug._resumeStack.pop();
		}

		if (funcToResume) {
			if (funcToResume instanceof shine.Coroutine) {
				retvals = funcToResume.resume();
				if (retvals) retvals.shift();

			} else if (funcToResume instanceof shine.Closure) {
				retvals = funcToResume._run();

			} else {
				retvals = funcToResume();
			}

		} else if ((running = this._vm._coroutineRunning) && running.status == shine.RESUMING) {
			// If we're resuming a coroutine function...

			funcToResume = running._resumeStack.pop();
			retvals = funcToResume._run();

		} else {
			// Prepare to run this function as usual

			if (b === 0) {
				l = this._register.getLength();

				for (i = a + 1; i < l; i++) {
					args.push(this._register.getItem(i));
				}

			} else {
				for (i = 0; i < b - 1; i++) {
					args.push(this._register.getItem(a + i + 1));
				}
			}
		}


		if (!funcToResume) {
			o = this._register.getItem(a);

			if ((o || shine.EMPTY_OBJ) instanceof shine.Function) {
				retvals = o.apply(null, args, true);

			} else if (o && o.apply) {
				retvals = o.apply(null, args);

			} else if (o && (o || shine.EMPTY_OBJ) instanceof shine.Table && (mt = o.__shine.metatable) && (f = mt.getMember('__call')) && f.apply) {
				args.unshift(o);
				retvals = f.apply(null, args, true);

			} else {
	 			throw new shine.Error('Attempt to call non-function');
			}
		}

		shine.gc.collect(args);


		if (this._vm._status == shine.SUSPENDING) {
			if (retvals !== undefined && this._vm._resumeVars === undefined) {
				this._vm._resumeVars = (retvals instanceof Array)? retvals : [retvals];
			}

			return;
		}

		if (!(retvals && retvals instanceof Array)) retvals = [retvals];

		if ((running = this._vm._coroutineRunning) && running.status == shine.SUSPENDING) return;


		if (c === 0) {
			l = retvals.length;

			for (i = 0; i < l; i++) {
				this._register.setItem(a + i, (o = retvals[i]) == null? undefined : o);		// null comparison for Flash API calls
			}

			this._register.splice(a + l);

		} else {
			for (i = 0; i < c - 1; i++) {
				this._register.setItem(a + i, (o = retvals[i]) == null? undefined : o);		// null comparison for Flash API calls
			}
		}

	}




	function tailcall (a, b) {
		return call.call(this, a, b, 0);

		// NOTE: Currently not replacing stack, so infinately recursive calls WOULD drain memory, unlike how tail calls were intended.
		// TODO: For non-external function calls, replace this stack with that of the new function. Possibly return the Function and handle the call in the RETURN section (for the calling function).
	}




	function return_ (a, b) {
		var retvals = shine.gc.createArray(),
			val,
			i, l;

		if (b === 0) {
			l = this._register.getLength();

			for (i = a; i < l; i++) {
				retvals.push(this._register.getItem(i));
			}

		} else {
			for (i = 0; i < b - 1; i++) {
				retvals.push(val = this._register.getItem(a + i));
				shine.gc.incrRef(val);
			}
		}

		close.call(this, 0);

//		this._register.reset();
		this.dead = true;

		return retvals;
	}




	function forloop (a, sbx) {
		var step = this._register.getItem(a + 2),
			limit = this._register.getItem(a + 1),
			index = this._register.getItem(a) + step,
			parity = step / Math.abs(step);

		this._register.setItem(a, index);

		if ((parity === 1 && index <= limit) || (parity !== 1 && index >= limit)) {
			this._register.setItem(a + 3, index);
			this._pc += sbx;
		}
	}




	function forprep (a, sbx) {
		this._register.setItem(a, this._register.getItem(a) - this._register.getItem(a + 2));
		this._pc += sbx;
	}




	function tforloop (a, b, c) {
		var args = shine.gc.createArray(),
			retvals,
			val,
			index;

		args.push(this._register.getItem(a + 1), this._register.getItem(a + 2));
		retvals = this._register.getItem(a).apply(undefined, args);

		if (!((retvals || shine.EMPTY_OBJ) instanceof Array)) {
			val = shine.gc.createArray();
			val.push(retvals);
			retvals = val;
		}

		for (var i = 0; i < c; i++) this._register.setItem(a + i + 3, retvals[i]);

		if ((val = this._register.getItem(a + 3)) !== undefined) {
			this._register.setItem(a + 2, val);
		} else {
			this._pc++;
		}
	}




	function setlist (a, b, c) {
		var length = b || this._register.getLength() - a - 1,
		i;

		for (i = 0; i < length; i++) {
			this._register.getItem(a).setMember(50 * (c - 1) + i + 1, this._register.getItem(a + i + 1));
		}
	}




	function close (a, b, c) {
		for (var i = 0, l = this._localsUsedAsUpvalues.length; i < l; i++) {
			var local = this._localsUsedAsUpvalues[i];

			if (local && local.registerIndex >= a) {
				local.upvalue.value = this._register.getItem(local.registerIndex);
				local.upvalue.open = false;

				this._localsUsedAsUpvalues.splice(i--, 1);
				l--;
				this._register.clearItem(local.registerIndex);
			}
		}
	}




	function closure (a, bx) {
		var me = this,
			upvalues = shine.gc.createArray(),
			opcode;

		while ((opcode = this._instructions[this._pc * 4]) !== undefined && (opcode === 0 || opcode === 4) && this._instructions[this._pc * 4 + 1] === 0) {	// move, getupval

			(function () {
				var op = opcode,
					offset = me._pc * 4,
					A = me._instructions[offset + 1],
					B = me._instructions[offset + 2],
					C = me._instructions[offset + 3],
					upvalue;

				// shine.stddebug.write('-> ' + me.constructor.OPERATION_NAMES[op] + '\t' + A + '\t' + B + '\t' + C);


				if (op === 0) {	// move
					for (var j = 0, l = me._localsUsedAsUpvalues.length; j < l; j++) {
						var up = me._localsUsedAsUpvalues[j];
						if (up.registerIndex === B) {
							upvalue = up.upvalue;
							break;
						}
					}

					if (!upvalue) {
						upvalue = {
							open: true,
							getValue: function () {
								return this.open? me._register.getItem(B) : this.value;
							},
							setValue: function (val) {
								if (this.open) {
									me._register.setItem(B, val);
								} else {
									shine.gc.incrRef(val);
									shine.gc.decrRef(this.value);
									this.value = val;
								}
							},
							name: me._functions[bx].upvalues? me._functions[bx].upvalues[upvalues.length] : '(upvalue)'
						};

						me._localsUsedAsUpvalues.push({
							registerIndex: B,
							upvalue: upvalue
						});
					}

					upvalues.push(upvalue);


				} else {	//getupval

					upvalues.push({
						getValue: function () {
							return me._upvalues[B].getValue();
						},
						setValue: function (val) {
							me._upvalues[B].setValue(val);
						},
						name: me._upvalues[B].name
					});
				}

			})();

			this._pc++;
		}

		var func = new shine.Function(this._vm, this._file, this._functions[bx], this._globals, upvalues);
		//this._funcInstances.push(func);
		this._register.setItem(a, func);
	}




	function vararg (a, b) {
		var i, l,
			limit = b === 0? Math.max(0, this._params.length - this._data.paramCount) : b - 1;

		for (i = 0; i < limit; i++) {
			this._register.setItem(a + i, this._params[this._data.paramCount + i]);
		}

		// Assumption: Clear the remaining items in the register.
		for (i = a + limit, l = this._register.getLength(); i < l; i++) {
			this._register.clearItem(i);
		}
	}



	shine.Closure.OPERATIONS = [move, loadk, loadbool, loadnil, getupval, getglobal, gettable, setglobal, setupval, settable, newtable, self, add, sub, mul, div, mod, pow, unm, not, len, concat, jmp, eq, lt, le, test, testset, call, tailcall, return_, forloop, forprep, tforloop, setlist, close, closure, vararg];
	shine.Closure.OPERATION_NAMES = ['move', 'loadk', 'loadbool', 'loadnil', 'getupval', 'getglobal', 'gettable', 'setglobal', 'setupval', 'settable', 'newtable', 'self', 'add', 'sub', 'mul', 'div', 'mod', 'pow', 'unm', 'not', 'len', 'concat', 'jmp', 'eq', 'lt', 'le', 'test', 'testset', 'call', 'tailcall', 'return', 'forloop', 'forprep', 'tforloop', 'setlist', 'close', 'closure', 'vararg'];

})();







// vm/src/Function.js:



'use strict';


var shine = shine || {};


/**
 * Represents a function definition.
 * @constructor
 * @extends shine.EventEmitter
 * @param {shine.File} file The file in which the function is declared.
 * @param {object} data Object containing the Luac data for the function.
 * @param {object} globals The global variables for the environment in which the function is declared.
 * @param {object} [upvalues] The upvalues passed from the parent closure.
 */
shine.Function = function (vm, file, data, globals, upvalues) {
	this._vm = vm;
	this._file = file;
	this._data = data || shine.gc.createObject();
	this._globals = globals;
	this._upvalues = upvalues || shine.gc.createObject();
	this._index = shine.Function._index++;
	this.instances = shine.gc.createArray();
	this._retainCount = 0;

 	this._convertInstructions();
};


shine.Function.prototype = {};
shine.Function.prototype.constructor = shine.Function;


/**
 * Keeps a count of the number of functions created, in order to index them uniquely.
 * @type Number
 * @static
 */
shine.Function._index = 0;




/**
 * Creates a new function instance from the definition.
 * @returns {shine.Closure} An instance of the function definition.
 */
shine.Function.prototype.getInstance = function () {
	return shine.Closure.create(this._vm, this._file, this._data, this._globals, this._upvalues);
};




/**
 * Converts the function's instructions from the format in file into ArrayBuffer or Array in place.
 */
shine.Function.prototype._convertInstructions = function () {
	var instructions = this._data.instructions || shine.gc.createArray(),
		buffer,
		result,
		i, l,
		instruction,
		offset;

	if ('ArrayBuffer' in window) {
		if (instructions instanceof Int32Array) return;

		if (instructions.length == 0 || instructions[0].op === undefined) {
			buffer = new ArrayBuffer(instructions.length * 4);
			result = new Int32Array(buffer);

			result.set(instructions);
			this._data.instructions = result;
			return;
		}

		buffer = new ArrayBuffer(instructions.length * 4 * 4);
		result = new Int32Array(buffer);

	} else {
		if (instructions.length == 0 || typeof instructions[0] == 'number') return;
		result = [];
	}

	for (i = 0, l = instructions.length; i < l; i++) {
		instruction = instructions[i];
		offset = i * 4;

		result[offset] = instruction.op;
		result[offset + 1] = instruction.A;
		result[offset + 2] = instruction.B;
		result[offset + 3] = instruction.C;
	}

	this._data.instructions = result;
};




/**
 * Calls the function, implicitly creating a new instance and passing on the arguments provided.
 * @returns {Array} Array of the return values from the call.
 */
shine.Function.prototype.call = function () {
	var args = shine.gc.createArray(),
		l = arguments.length,
		i;

	for (i = 1; i < l; i++) args.push(arguments[i]);
	return this.apply(args);
};




/**
 * Calls the function, implicitly creating a new instance and using items of an array as arguments.
 * @param {object} [obj = {}] The object on which to apply the function. Included for compatibility with JavaScript's Function.apply().
 * @param {Array} args Array containing arguments to use.
 * @returns {Array} Array of the return values from the call.
 */
shine.Function.prototype.apply = function (obj, args, internal) {
	if ((obj || shine.EMPTY_OBJ) instanceof Array && !args) {
		args = obj;
		obj = undefined;
	}

	try {
		return this.getInstance().apply(obj, args);

	} catch (e) {
		shine.Error.catchExecutionError(e);
	}
};




/**
 * Creates a unique description of the function.
 * @returns {string} Description.
 */
shine.Function.prototype.toString = function () {
	return 'function: 0x' + this._index.toString(16);
};




/**
 * Saves this function from disposal.
 */
shine.Function.prototype.retain = function () {
	this._retainCount++;
};




/**
 * Releases this function to be disposed.
 */
shine.Function.prototype.release = function () {
	if (!--this._retainCount && this._readyToDispose) this.dispose();
};




/**
 * Test if the function has been marked as retained.
 * @returns {boolean} Whether or not the function is marked as retained.
 */
shine.Function.prototype.isRetained = function () {
	if (this._retainCount) return true;

	for (var i in this.instances) {
		if (this.instances.hasOwnProperty(i) && this.instances[i].hasRetainedScope()) return true;
	}

	return false;
};




/**
 * Dump memory associated with function.
 * returns {Boolean} Whether or not the function was dumped successfully.
 */
shine.Function.prototype.dispose = function (force) {
	this._readyToDispose = true;

	if (force) {
		for (var i = 0, l = this.instances.length; i < l; i++) {
			this.instances[i].dispose(true);
		}

	} else if (this.isRetained()) {
		return false;
	}

	delete this._vm;
	delete this._file;
	delete this._data;
	delete this._globals;
	delete this._upvalues;

	delete this.instances;
	delete this._readyToDispose;

	return true;
};








// vm/src/Coroutine.js:



'use strict';


var shine = shine || {};


/**
 * Represents a single coroutine (thread).
 * @constructor
 * @extends shine.EventEmitter
 * @param {shine.Closure} closure The closure that is to be executed in the thread.
 */
shine.Coroutine = function (closure) {
	shine.EventEmitter.call(this);

	this._func = closure.getInstance();
	this._index = shine.Coroutine._index++;
	this._started = false;
	this._yieldVars = undefined;
	this._resumeStack = this._resumeStack || shine.gc.createArray();
	this.status = shine.SUSPENDED;

	shine.stddebug.write ('[coroutine created]\n');
};


shine.Coroutine.prototype = new shine.EventEmitter();
shine.Coroutine.prototype.constructor = shine.Function;


shine.Coroutine._index = 0;
shine.Coroutine._graveyard = [];


shine.Coroutine.create = function (closure) {
	var instance = shine.Coroutine._graveyard.pop();

	if (instance) {
		shine.Coroutine.apply(instance, arguments);
		return instance;

	} else {
		return new shine.Coroutine(closure);
	}
};




/**
 * Adds a new coroutine to the top of the run stack.
 * @static
 * @param {shine.Coroutine} co A running coroutine.
 */
shine.Coroutine._add = function (co) {
	var vm = shine.getCurrentVM();
	vm._coroutineStack.push(vm._coroutineRunning);
	vm._coroutineRunning = co;
};




/**
 * Removes a coroutine from the run stack.
 * @static
 */
shine.Coroutine._remove = function () {
	var vm = shine.getCurrentVM();
	vm._coroutineRunning = vm._coroutineStack.pop();
};




/**
 * Rusumes a suspended coroutine.
 * @returns {Array} Return values, either after terminating or from a yield.
 */
shine.Coroutine.prototype.resume = function () {
	var retval,
		funcToResume,
		vm = this._func._instance._vm;

	try {
		if (this.status == shine.DEAD) throw new shine.Error ('cannot resume dead coroutine');

		shine.Coroutine._add(this);

		if (vm && vm._status == shine.RESUMING) {
			funcToResume = vm._resumeStack.pop();

		} else if (shine.debug && shine.debug._status == shine.RESUMING) {
			funcToResume = shine.debug._resumeStack.pop();
		}

		if (funcToResume) {
			if (funcToResume instanceof shine.Coroutine) {
				retval = funcToResume.resume();

			} else if (funcToResume instanceof Function) {
				retval = funcToResume();

			} else {
				retval = this._func._instance._run();
			}

		} else if (!this._started) {
			this.status = shine.RUNNING;
			shine.stddebug.write('[coroutine started]\n');

			this._started = true;
			retval = this._func.apply(null, arguments);

		} else {
			this.status = shine.RESUMING;
			shine.stddebug.write('[coroutine resuming]\n');

			if (!arguments.length) {
				this._yieldVars = undefined;

			} else {
				var args = shine.gc.createArray();
				for (var i = 0, l = arguments.length; i < l; i++) args.push(arguments[i]);

				this._yieldVars = args;
			}

			retval = this._resumeStack.pop()._run();
		}

		if (shine.debug && shine.debug._status == shine.SUSPENDING) {
			shine.debug._resumeStack.push(this);
			return;
		}

		this.status = this._func._instance.terminated? shine.DEAD : shine.SUSPENDED;

		if (retval) retval.unshift(true);

	} catch (e) {
		if (!e.luaStack) e.luaStack = shine.gc.createArray();
		e.luaStack.push([this._func._instance, this._func._instance._pc - 1]);

		retval = [false, e];
		this.status = shine.DEAD;
	}

	if (this.status == shine.DEAD) {
		shine.Coroutine._remove();
		shine.stddebug.write('[coroutine terminated]\n');
		this._dispose();
	}

	return retval;
};




/**
 * Returns a unique identifier for the thread.
 * @returns {string} Description.
 */
shine.Coroutine.prototype.toString = function () {
	return 'thread:' + (this._index? '0x' + this._index.toString(16) : '[dead]');
};




/**
 * Dumps memory used by the coroutine.
 */
shine.Coroutine.prototype._dispose = function () {

	delete this._func;
	delete this._index;
	delete this._listeners;
	// delete this._resumeStack;
	delete this._started;
	delete this._yieldVars
	delete this.status

	this._resumeStack.length = 0;

	shine.Coroutine._graveyard.push(this);
};







// vm/src/Table.js:



'use strict';


var shine = shine || {};


/**
 * Represents a table in Lua.
 * @param {Object} obj Initial values to set up in the new table.
 */
shine.Table = function (obj) {

	var isArr = ((obj || shine.EMPTY_OBJ) instanceof Array),
		meta,
		key,
		value,
		i;

	obj = obj || shine.gc.createObject();

	this.__shine = meta = shine.gc.createObject();
	meta.type = 'table';
	meta.index = ++shine.Table.count;
	meta.keys = shine.gc.createArray();
	meta.values = shine.gc.createArray();
	meta.numValues = [undefined];


	for (i in obj) {
		if (obj.hasOwnProperty(i)) {
			var iterate;

			key = isArr? parseInt(i, 10) + 1: i;
			value = obj[i];
			if (value === null) value = undefined;

			if (typeof getQualifiedClassName !== 'undefined') {
				// ActionScript
				iterate = (getQualifiedClassName(value) == 'Object' && !(value instanceof shine.Table) && !(value instanceof shine.Coroutine) && !(value instanceof shine.Function) && !(value instanceof shine.Closure)) || getQualifiedClassName(value) == 'Array';
			} else {
				// JavaScript
				iterate = (typeof value == 'object' && value.constructor === Object) || value instanceof Array;
			}

			this.setMember(key, iterate? new shine.Table(value) : value);
		}
	}

};


/**
 * Keeps a count of the number of tables created, in order to index them uniquely.
 * @type Number
 * @static
 */
shine.Table.count = 0;




/**
 * Gets a member of this table. If not found, search the metatable chain.
 * @param {Object} key The member's key.
 * @returns {Object} The value of the member sought.
 */
shine.Table.prototype.getMember = function (key) {
	var typ = typeof key,
		index, value, mt, mm;

	if (typ == 'string' && (key == 'getMember' || key == 'setMember')) typ = 'object';

	switch (typ) {
		case 'string':
			if (this.hasOwnProperty(key) && this[key] !== undefined) return this[key];
			break;

		case 'number':
			value = this.__shine.numValues[key];
			if (value !== undefined) return value;
			break

		default:
			index = this.__shine.keys.indexOf(key);
			if (index >= 0) return this.__shine.values[index];
	}

	if ((mt = this.__shine.metatable) && (mm = mt.__index)) {
		switch (mm.constructor) {
			case shine.Table: return mm.getMember(key);
			case Function: return mm(this, key);
			case shine.Function: return mm.apply(this, [this, key])[0];
		}
	}
};




/**
 * Sets a member of this table.
 * @param {Object} key The member's key.
 * @param {Object} value The new value of the member.
 */
shine.Table.prototype.setMember = function (key, value) {
	var mt = this.__shine.metatable,
		typ = typeof key,
		oldValue,
		keys,
		index;

	if (typ == 'string' && (key == 'getMember' || key == 'setMember')) typ = 'object';

	switch (typ) {
		case 'string':
			oldValue = this[key];
			break;

		case 'number':
			oldValue = this.__shine.numValues[key];
			break;

		default:
			keys = this.__shine.keys;
			index = keys.indexOf(key);

			oldValue = index == -1? undefined : this.__shine.values[index];
			if (oldValue === undefined) shine.gc.incrRef(key);
	}

	if (oldValue === undefined && mt && mt.__newindex) {
		switch (mt.__newindex.constructor) {
			case shine.Table: return mt.__newindex.setMember(key, value);
			case Function: return mt.__newindex(this, key, value);
			case shine.Function: return mt.__newindex.apply(this, [this, key, value])[0];
		}
	}

	switch (typ) {
		case 'string':
			this[key] = value;
			break;

		case 'number':
			this.__shine.numValues[key] = value;
			break;

		default:
			if (index < 0) {
				index = keys.length;
				keys[index] = key;
			}

			this.__shine.values[index] = value;
	}

	shine.gc.incrRef(value);
	shine.gc.decrRef(oldValue);
};




/**
 * Returns a unique identifier for the table.
 * @returns {string} Description.
 */
shine.Table.prototype.toString = function () {
	var mt;

	if (this.constructor != shine.Table) return 'userdata';
	if (this.__shine && (mt = this.__shine.metatable) && mt.__tostring) return mt.__tostring.call(undefined, this)[0];

	return 'table: 0x' + this.__shine.index.toString(16);
};




// vm/src/Error.js:



'use strict';


var shine = shine || {};


/**
 * An error that occurs in the Lua code.
 * @constructor
 * @param {string} message Error message.
 */
shine.Error = function (message) {
	this.message = message;
};


shine.Error.prototype = Object['create']? Object['create'](Error.prototype) : new Error();	// Overcomes Chromium bug: https://code.google.com/p/chromium/issues/detail?id=228909
shine.Error.prototype.constructor = shine.Error;




/**
 * Handles error reporting in a consistent manner.
 * @static
 * @param {Error|shine.Error} e Error that was thown.
 */
shine.Error.catchExecutionError = function (e) {
	if (!e) return;

	if ((e || shine.EMPTY_OBJ) instanceof shine.Error) {
		if (!e.luaMessage) e.luaMessage = e.message;
		// e.message = e.luaMessage + '\n    ' + (e.luaStack || shine.gc.createArray()).join('\n    ');
		e.message = e.luaMessage + '\n    ' + e._stackToString();
	}

	throw e;
};




/**
 * Coerces the error to a string for logging.
 * @return {string} String representation of error.
 */
shine.Error.prototype._stackToString = function () {
	var result = [],
		closure, pc,
		funcName, parent, up,
		filename, path,
		i, j, l;

	this.luaStack = this.luaStack || [];

	for (i = 0, l = this.luaStack.length; i < l; i++) {
		if (this.luaStack[i - 1]
			&& this.luaStack[i][0] === this.luaStack[i - 1][0]
			&& this.luaStack[i][1] === this.luaStack[i - 1][1]
		) {
			continue;	// Filter out repeated items (due to lib.require).
		}


		if (typeof this.luaStack[i] == 'string') {
			result.push(this.luaStack[i]);

		} else {
			closure = this.luaStack[i][0];
			pc = this.luaStack[i][1];

			if (!(funcName = closure._data.sourceName)) {

				if (parent = this.luaStack[i + 1] && this.luaStack[i + 1][0]) {
					// Search locals
					for (j in parent._localFunctions) {
						if (parent._localFunctions[j]._data === closure._data) {
							funcName = j;
							break;
						}
					}

					// Search upvalues
					if (!funcName) {
						for (j in parent._upvalues) {
							up = parent._upvalues[j].getValue();

							if ((up || shine.EMPTY_OBJ) instanceof shine.Function && up._data === closure._data) {
								funcName = parent._upvalues[j].name;
								break;
							}
						}
					}
				}

				// Search globals
				if (!funcName) {
					for (j in closure._globals) {
						if ((closure._globals[j] || shine.EMPTY_OBJ) instanceof shine.Function && closure._globals[j]._data === closure._data) {
							funcName = j;
							break;
						}
					}
				}
			}


			if (filename = closure._file.data.sourcePath) {
				filename = closure._file.url.match('^(.*)\/.*?$');
				filename = (filename === null? '.' : filename[1] || '') + '/' + filename;
				filename = filename.replace(/\/\.\//g, '/').replace(/\/.*?\/\.\.\//g, '/');
			} else {
				filename = closure._file.url;
			}

			result.push ((funcName || 'function') + ' [' + (filename || 'file') + ':' + (closure._data.linePositions? closure._data.linePositions[pc] : '?') + ']')
		}
	}

	return result.join('\n    ');
};




/**
 * Coerces the error to a string for logging.
 * @return {string} String representation of error.
 */
shine.Error.prototype.toString = function () {
	return 'Moonshine run-time error: ' + this.message;
};



// vm/src/File.js:



'use strict';


var shine = shine || {};


/**
 * Represents a Luac data file.
 * @constructor
 * @extends shine.EventEmitter
 * @param {String} url Url of the distilled JSON file.
 */
shine.File = function (url, data) {
	this.url = url;
	this.data = data;
};




/**
 * Dump memory associated with file.
 */
shine.File.prototype.dispose = function () {
	delete this.url;
	delete this.data;
};





// vm/src/lib.js:



'use strict';


var shine = shine || {};



(function () {

	var RANDOM_MULTIPLIER = 16807,
		RANDOM_MODULUS = 2147483647,

		ROSETTA_STONE = {
			'([^a-zA-Z0-9%(])-': '$1*?',
	        '(.)-([^a-zA-Z0-9?])': '$1*?$2',
			'(.)-$': '$1*?',
			'%a': '[a-zA-Z]',
			'%A': '[^a-zA-Z]',
			'%c': '[\x00-\x1f]',
			'%C': '[^\x00-\x1f]',
			'%d': '\\d',
			'%D': '[^\d]',
			'%l': '[a-z]',
			'%L': '[^a-z]',
			'%p': '[\.\,\"\'\?\!\;\:\#\$\%\&\(\)\*\+\-\/\<\>\=\@\[\]\\\^\_\{\}\|\~]',
			'%P': '[^\.\,\"\'\?\!\;\:\#\$\%\&\(\)\*\+\-\/\<\>\=\@\[\]\\\^\_\{\}\|\~]',
			'%s': '[ \\t\\n\\f\\v\\r]',
			'%S': '[^ \t\n\f\v\r]',
			'%u': '[A-Z]',
			'%U': '[^A-Z]',
			'%w': '[a-zA-Z0-9]',
			'%W': '[^a-zA-Z0-9]',
			'%x': '[a-fA-F0-9]',
			'%X': '[^a-fA-F0-9]',
			'%([^a-zA-Z])': '\\$1'
		},

		DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],

		MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],

		DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],

		DATE_FORMAT_HANDLERS = {
			'%a': function (d, utc) { return DAYS[d['get' + (utc? 'UTC' : '') + 'Day']()].substr(0, 3); },
			'%A': function (d, utc) { return DAYS[d['get' + (utc? 'UTC' : '') + 'Day']()]; },
			'%b': function (d, utc) { return MONTHS[d['get' + (utc? 'UTC' : '') + 'Month']()].substr(0, 3); },
			'%B': function (d, utc) { return MONTHS[d['get' + (utc? 'UTC' : '') + 'Month']()]; },
			'%c': function (d, utc) { return d['to' + (utc? 'UTC' : '') + 'LocaleString'](); },
			'%d': function (d, utc) { return ('0' + d['get' + (utc? 'UTC' : '') + 'Date']()).substr(-2); },
			'%H': function (d, utc) { return ('0' + d['get' + (utc? 'UTC' : '') + 'Hours']()).substr(-2); },
			'%I': function (d, utc) { return ('0' + ((d['get' + (utc? 'UTC' : '') + 'Hours']() + 11) % 12 + 1)).substr(-2); },
			'%j': function (d, utc) {
				var result = d['get' + (utc? 'UTC' : '') + 'Date'](),
					m = d['get' + (utc? 'UTC' : '') + 'Month']();

				for (var i = 0; i < m; i++) result += DAYS_IN_MONTH[i];
				if (m > 1 && d['get' + (utc? 'UTC' : '') + 'FullYear']() % 4 === 0) result +=1;

				return ('00' + result).substr(-3);
			},
			'%m': function (d, utc) { return ('0' + (d['get' + (utc? 'UTC' : '') + 'Month']() + 1)).substr(-2); },
			'%M': function (d, utc) { return ('0' + d['get' + (utc? 'UTC' : '') + 'Minutes']()).substr(-2); },
			'%p': function (d, utc) { return (d['get' + (utc? 'UTC' : '') + 'Hours']() < 12)? 'AM' : 'PM'; },
			'%S': function (d, utc) { return ('0' + d['get' + (utc? 'UTC' : '') + 'Seconds']()).substr(-2); },
			'%U': function (d, utc) { return getWeekOfYear(d, 0, utc); },
			'%w': function (d, utc) { return '' + (d['get' + (utc? 'UTC' : '') + 'Day']()); },
			'%W': function (d, utc) { return getWeekOfYear(d, 1, utc); },
			'%x': function (d, utc) { return DATE_FORMAT_HANDLERS['%m'](d, utc) + '/' + DATE_FORMAT_HANDLERS['%d'](d, utc) + '/' + DATE_FORMAT_HANDLERS['%y'](d, utc); },
			'%X': function (d, utc) { return DATE_FORMAT_HANDLERS['%H'](d, utc) + ':' + DATE_FORMAT_HANDLERS['%M'](d, utc) + ':' + DATE_FORMAT_HANDLERS['%S'](d, utc); },
			'%y': function (d, utc) { return DATE_FORMAT_HANDLERS['%Y'](d, utc).substr (-2); },
			'%Y': function (d, utc) { return '' + d['get' + (utc? 'UTC' : '') + 'FullYear'](); },
			'%Z': function (d, utc) { var m; return (utc && 'UTC') || ((m = d.toString().match(/[A-Z][A-Z][A-Z]/)) && m[0]); },
			'%%': function () { return '%' }
		},


		randomSeed = 1,
		stringMetatable;




	function getRandom () {
		randomSeed = (RANDOM_MULTIPLIER * randomSeed) % RANDOM_MODULUS;
		return randomSeed / RANDOM_MODULUS;
	}




	function getVM (context) {
		if (context && context instanceof shine.VM) return context;

		var vm = shine.getCurrentVM();
		if (!vm) throw new shine.Error("Can't call library function without passing a VM object as the context");

		return vm;
	}




	function getWeekOfYear (d, firstDay, utc) {
		var dayOfYear = parseInt(DATE_FORMAT_HANDLERS['%j'](d), 10),
			jan1 = new Date(d.getFullYear (), 0, 1, 12),
			offset = (8 - jan1['get' + (utc? 'UTC' : '') + 'Day']() + firstDay) % 7;

		return ('0' + (Math.floor((dayOfYear - offset) / 7) + 1)).substr(-2);
	}




	function translatePattern (pattern) {
		// TODO Add support for balanced character matching (not sure this is easily achieveable).
		pattern = '' + pattern;

		var n = 0,
			i, l, character, addSlash;

		for (i in ROSETTA_STONE) if (ROSETTA_STONE.hasOwnProperty(i)) pattern = pattern.replace(new RegExp(i, 'g'), ROSETTA_STONE[i]);
		l = pattern.length;

		for (i = 0; i < l; i++) {
			character = pattern.substr(i, 1);
			addSlash = false;

			if (character == '[') {
				if (n) addSlash = true;
				n++;

			} else if (character == ']') {
				n--;
				if (n) addSlash = true;
			}

			if (addSlash) {
				// pattern = pattern.substr(0, i) + '\\' + pattern.substr(i++);
				pattern = pattern.substr(0, i) + pattern.substr(i++ + 1);
				l++;
			}
		}

		return pattern;
	}




	function loadfile (filename, callback) {
		var vm = getVM(this),
			file,
			pathData;

		vm.fileManager.load(filename, function (err, file) {
			if (err) {
				vm._trigger('module-load-error', [file, err]);

				if (err == 404 && /\.lua$/.test(filename)) {
					loadfile.call(vm, filename + '.json', callback);
				} else {
					callback();
				}

				return;
			}

			var func = new shine.Function(vm, file, file.data, vm._globals);
			vm._trigger('module-loaded', [file, func]);

			callback(func);
		});

		vm._trigger('loading-module', filename);
	}




	shine.lib = {


		assert: function (v, m) {
			if (v === false || v === undefined) throw new shine.Error(m || 'Assertion failed!');
			return [v, m];
		},




		collectgarbage: function (opt, arg) {
			// Unimplemented
		},




		dofile: function (filename) {
			// Unimplemented
		},




		error: function (message) {
			throw new shine.Error(message);
		},




		getfenv: function (f) {
			// Unimplemented
		},




		/**
		 * Implementation of Lua's getmetatable function.
		 * @param {object} table The table from which to obtain the metatable.
		 */
		getmetatable: function (table) {
			var mt;

			if (table instanceof shine.Table) {
				if ((mt = table.__shine.metatable) && (mt = mt.__metatable)) return mt;
				return table.__shine.metatable;

			} else if (typeof table == 'string') {
				return stringMetatable;
			}
		},




		ipairs: function (table) {
			if (!((table || shine.EMPTY_OBJ) instanceof shine.Table)) throw new shine.Error('Bad argument #1 in ipairs(). Table expected');

			var iterator = function (table, index) {
				if (index === undefined) throw new shine.Error('Bad argument #2 to ipairs() iterator');

				var nextIndex = index + 1;

				if (!table.__shine.numValues.hasOwnProperty(nextIndex)) return undefined;
				return [nextIndex, table.__shine.numValues[nextIndex]];
			};

			return [iterator, table, 0];
		},




		load: function (func, chunkname) {
			var vm = getVM(this),
				chunk = '', piece, lastPiece;

			while ((piece = func.apply(func)) && (piece = piece[0])) {
				chunk += (lastPiece = piece);
			}

			return shine.lib.loadstring.call(vm, chunk);
		},




		loadfile: function (filename) {
			var vm = getVM(this),
				callback = function (result) {
					vm.resume(result || []);
				};

			vm.suspend();
			loadfile.call(vm, filename, callback);
		},




		loadstring: function (string, chunkname) {
			var vm = getVM(this);

			if (typeof string != 'string') throw new shine.Error('bad argument #1 to \'loadstring\' (string expected, got ' + shine.utils.coerce(string, 'string') + ')');
			if (!string) return new shine.Function(vm);

			vm.suspend();

			vm.fileManager.load(string, function (err, file) {
				if (err) {
					vm.resume([]);
					return;
				}

				var func = new shine.Function(vm, file, file.data, vm._globals, shine.gc.createArray());
				vm.resume([func]);
			});
		},




		/**
		 * Implementation of Lua's next function.
		 * @param {object} table The table that will receive the metatable.
		 * @param {object} index Index of the item to return.
		 */
		next: function (table, index) {
			// SLOOOOOOOW...
			var found = (index === undefined),
				numValues = table.__shine.numValues,
				i, l;

			if (found || typeof index == 'number') {
				for (i = 1, l = numValues.length; i < l; i++) {

					if (!found) {
						if (i === index) found = true;

					} else if (numValues.hasOwnProperty(i) && numValues[i] !== undefined) {
						return [i, numValues[i]];
					}
				}
			}

			for (i in table) {
				if (table.hasOwnProperty(i) && !(i in shine.Table.prototype) && i !== '__shine') {
					if (!found) {
						if (i == index) found = true;

					} else if (table.hasOwnProperty(i) && table[i] !== undefined && ('' + i).substr(0, 2) != '__') {
						return [i, table[i]];
					}
				}
			}

			for (i in table.__shine.keys) {
				if (table.__shine.keys.hasOwnProperty(i)) {
					var key = table.__shine.keys[i];

					if (!found) {
						if (key === index) found = true;

					} else if (table.__shine.values[i] !== undefined) {
						return [key, table.__shine.values[i]];
					}
				}
			}

			return shine.gc.createArray();
		},




		/**
		 * Implementation of Lua's pairs function.
		 * @param {object} table The table to be iterated over.
		 */
		pairs: function (table) {
			if (!((table || shine.EMPTY_OBJ) instanceof shine.Table)) throw new shine.Error('Bad argument #1 in pairs(). Table expected');
			return [shine.lib.next, table];
		},




		pcall: function (func) {
			var args = shine.gc.createArray(),
				result;

			for (var i = 1, l = arguments.length; i < l; i++) args.push (arguments[i]);

			try {
				if (typeof func == 'function') {
					result = func.apply(null, args);

				} else if ((func || shine.EMPTY_OBJ) instanceof shine.Function) {
					result = func.apply(null, args, true);

				} else {
					throw new shine.Error('Attempt to call non-function');
				}

			} catch (e) {
				return [false, e && e.message || e];
			}

			if (!((result || shine.EMPTY_OBJ) instanceof Array)) result = [result];
			result.unshift(true);

			return result;
		},




		print: function () {
			var output = shine.gc.createArray(),
				item;

			for (var i = 0, l = arguments.length; i< l; i++) {
				output.push(shine.lib.tostring(arguments[i]));
			}

			return shine.stdout.write(output.join('\t'));
		},




		rawequal: function (v1, v2) {
			return (v1 === v2);
		},




		rawget: function (table, index) {
			if (!((table || shine.EMPTY_OBJ) instanceof shine.Table)) throw new shine.Error('Bad argument #1 in rawget(). Table expected');
			return table[index];
		},




		rawset: function (table, index, value) {
			if (!((table || shine.EMPTY_OBJ) instanceof shine.Table)) throw new shine.Error('Bad argument #1 in rawset(). Table expected');
			if (index == undefined) throw new shine.Error('Bad argument #2 in rawset(). Nil not allowed');

			table[index] = value;
			return table;
		},




		require: function (modname) {
			var vm = getVM(this),
				packageLib = vm._globals['package'],
				current = shine.Closure._current,
				module,
				preload,
				paths,
				path,
				failedPaths = shine.gc.createArray();


			function curryLoad (func) {
				return function () {
					return load(func);
				}
			};


			function load (preloadFunc) {
				var result;

				if (vm._resumeStack.length) {
					result = vm._resumeStack.pop()._run();

				} else if (shine.debug && shine.debug._resumeStack.length) {
					result = shine.debug._resumeStack.pop()._run();

				} else {
					packageLib.loaded[modname] = true;
					result = preloadFunc.call(null, modname);
				}

				if (vm._status == shine.SUSPENDING && !result) {
					current._pc--;
					vm._resumeStack.push(curryLoad(preloadFunc));
					return;

				} else if (shine.debug && shine.debug._status == shine.SUSPENDING && !result) {
					current._pc--;
					shine.debug._resumeStack.push(curryLoad(preloadFunc));
					return;
				}


				if (!result) return;
				module = result[0];

				if (module !== undefined) packageLib.loaded.setMember(modname, module);
				return packageLib.loaded[modname];
			}

			modname = shine.utils.coerce(modname, 'string');
			if (module = packageLib.loaded[modname]) return module;
			if (preload = packageLib.preload[modname]) return load(preload);

			paths = packageLib.path.replace(/;;/g, ';').split(';');
			vm.suspend();


			function loadNextPath () {
				path = paths.shift();

				if (!path) {
					throw new shine.Error('module \'' + modname + '\' not found:' + '\n	no field package.preload[\'' + modname + '\']\n' + failedPaths.join('\n'));

				} else {
					path = path.replace(/\?/g, modname.replace(/\./g, '/'));

					loadfile.call(vm, path, function (preload) {

						if (preload) {
							packageLib.preload[modname] = preload;
							shine.Closure._current._pc--;
							vm.resume();

						} else {
							failedPaths.push('	no file \'' + path + '\'');
							loadNextPath();
						}
					});
				}
			}

			loadNextPath();
		},




		select: function (index) {
			var args = shine.gc.createArray();

			if (index == '#') {
				return arguments.length - 1;

			} else if (index = parseInt(index, 10)) {
				return Array.prototype.slice.call(arguments, index);

			} else {
				throw new shine.Error('bad argument #1 in select(). Number or "#" expected');
			}
		},




		/**
		 * Implementation of Lua's setmetatable function.
		 * @param {object} table The table that will receive the metatable.
		 * @param {object} metatable The metatable to attach.
		 */
		setmetatable: function (table, metatable) {
			var mt;

			if (!((table || shine.EMPTY_OBJ) instanceof shine.Table)) throw new shine.Error('Bad argument #1 in setmetatable(). Table expected');
			if (!(metatable === undefined || (metatable || shine.EMPTY_OBJ) instanceof shine.Table)) throw new shine.Error('Bad argument #2 in setmetatable(). Nil or table expected');
			if ((mt = table.__shine.metatable) && (mt = mt.__metatable)) throw new shine.Error('cannot change a protected metatable');

			shine.gc.incrRef(metatable);
			shine.gc.decrRef(table.__shine.metatable);

			table.__shine.metatable = metatable;

			return table;
		},




		tonumber: function (e, base) {
			var match, chars, pattern;

			if (e === '') return;

            base = base || 10;

			if (base < 2 || base > 36) throw new shine.Error('bad argument #2 to tonumber() (base out of range)');
			if (base == 10 && (e === Infinity || e === -Infinity || (typeof e == 'number' && window.isNaN(e)))) return e;

			if (base != 10 && e == undefined) throw new shine.Error('bad argument #1 to \'tonumber\' (string expected, got nil)');
            e = ('' + e).replace(/^\s+|\s+$/g, '');    // Trim

            // If using base 10, use normal coercion.
			if (base == 10) return shine.utils.coerce(e, 'number');

			e = shine.utils.coerce(e, 'string');

            // If using base 16, ingore any "0x" prefix
			if (base == 16 && (match = e.match(/^(\-)?0[xX](.+)$/))) e = (match[1] || '') + match[2];

			chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
			pattern = new RegExp('^[' + chars.substr(0, base) + ']*$', 'gi');

			if (!pattern.test(e)) return;	// Invalid
			return parseInt(e, base);
		},




		tostring: function (e) {
			var mt, mm;

			if (e !== undefined && e instanceof shine.Table && (mt = e.__shine.metatable) && (mm = mt.getMember('__tostring'))) return mm.call(mm, e);

			if (e instanceof shine.Table || e instanceof shine.Function) return e.toString();
			if (typeof e == 'function') return 'function: [host code]';

			return shine.utils.coerce(e, 'string') || 'userdata';
		},




		type: function (v) {
			var t = typeof v;

			switch (t) {
				case 'undefined':
					return 'nil';

				case 'number':
				case 'string':
				case 'boolean':
				case 'function':
					return t;

				case 'object':
					if (v.constructor === shine.Table) return 'table';
					if ((v || shine.EMPTY_OBJ) instanceof shine.Function) return 'function';

					return 'userdata';
			}
		},



		unpack: function (table, i, j) {
			// v5.2: shine.warn ('unpack is deprecated. Use table.unpack instead.');
			return shine.lib.table.unpack(table, i, j);
		},




		_VERSION: 'Lua 5.1',




		xpcall: function (func, err) {
			var result, success, invalid;

			try {
				if (typeof func == 'function') {
					result = func.apply();

				} else if ((func || shine.EMPTY_OBJ) instanceof shine.Function) {
					result = func.apply(null, undefined, true);

				} else {
					invalid = true;
				}

				success = true;

			} catch (e) {
				result = err.apply(null, undefined, true);
				if (((result || shine.EMPTY_OBJ) instanceof Array)) result = result[0];

				success = false;
			}

			if (invalid) throw new shine.Error('Attempt to call non-function');

			if (!((result || shine.EMPTY_OBJ) instanceof Array)) result = [result];
			result.unshift(success);

			return result;
		}


	};




	shine.lib.coroutine = new shine.Table({


		create: function (closure) {
			//return new shine.Coroutine (closure);
			return shine.Coroutine.create(closure);
		},




		resume: function (thread) {
			if (arguments.length < 2) return thread.resume.call(thread);

			var args = shine.gc.createArray();
			for (var i = 1, l = arguments.length; i < l; i++) args.push(arguments[i]);

			return thread.resume.apply(thread, args);
		},




		running: function () {
			var vm = getVM(this);
			return vm._coroutineRunning;
		},




		status: function (co) {
			switch (co.status) {
				case shine.RUNNING: return (co === getVM()._coroutineRunning)? 'running' : 'normal';
				case shine.SUSPENDED: return 'suspended';
				case shine.DEAD: return 'dead';
			}
		},




		wrap: function (closure) {
			var co = shine.lib.coroutine.create(closure),
				vm = getVM(this);

			var result = function () {
				var args = [co];
				for (var i = 0, l = arguments.length; i < l; i++) args.push(arguments[i]);

				var retvals = shine.lib.coroutine.resume.apply(null, args),
					success;

				if (!retvals && (vm._status == shine.SUSPENDING || (shine.debug && shine.debug._status == shine.SUSPENDING))) return;
				success = retvals.shift();

				if (success) return retvals;
				throw retvals[0];
			};

			result._coroutine = co;
			return result;
		},




		yield: function () {
			var running = getVM()._coroutineRunning,
				args;

			// If running in main thread, throw error.
			if (!running) throw new shine.Error('attempt to yield across metamethod/C-call boundary (not in coroutine)');
			if (running.status != shine.RUNNING) throw new shine.Error('attempt to yield non-running coroutine in host');

			args = shine.gc.createArray();
			for (var i = 0, l = arguments.length; i < l; i++) args.push(arguments[i]);

			running._yieldVars = args;
			running.status = shine.SUSPENDING;

			return {
				resume: function () {
					var args = [running],
						i,
						l = arguments.length,
						f = function () {
							shine.lib.coroutine.resume.apply(undefined, args);
						};

					if (arguments.length == 1 && arguments[0] === undefined) l = 0;
					for (i = 0; i < l; i++) args.push(arguments[i]);

					if (running.status == shine.SUSPENDING) {
						window.setTimeout(f, 1);
					} else {
						f();
					}
				}
			}
		}

	});




	shine.lib.debug = new shine.Table({

		debug: function () {
			// Not implemented
		},


		getfenv: function (o) {
			// Not implemented
		},


		gethook: function (thread) {
			// Not implemented
		},


		getinfo: function (thread, func, what) {
			// Not implemented
		},


		getlocal: function (thread, level, local) {
			// Not implemented
		},


		getmetatable: function (object) {
			// Not implemented
		},


		getregistry: function () {
			// Not implemented
		},


		getupvalue: function (func, up) {
			// Not implemented
		},


		setfenv: function (object, table) {
			// Not implemented
		},


		sethook: function (thread, hook, mask, count) {
			// Not implemented
		},


		setlocal: function (thread, level, local, value) {
			// Not implemented
		},


		setmetatable: function (object, table) {
			// Not implemented
		},


		setupvalue: function (func, up, value) {
			// Not implemented
		},


		traceback: function (thread, message, level) {
			// Not implemented
		}
	});




	shine.lib.io = new shine.Table({


		close: function (file) {
			if (file) throw new shine.Error('File operations currently not supported.');
			// Default behaviour: Do nothing.
		},




		flush: function () {
			// Default behaviour: Do nothing.
			// TODO: shine.stdout.flush(); // ??
		},




		input: function (file) {
			throw new shine.Error('File operations currently not supported.');
		},




		lines: function (filename) {
			throw new shine.Error('File operations currently not supported.');
		},




		open: function (filename) {
			throw new shine.Error('File operations currently not supported.');
		},




		output: function (file) {
			throw new shine.Error('File operations currently not supported.');
		},




		popen: function (prog, mode) {
			throw new shine.Error('File operations currently not supported.');
		},




		read: function () {
			throw new shine.Error('File operations currently not supported.');
		},




		stderr: {},	// Userdata
		stdin: {},
		stdout: {},




		tmpfile: function () {
			throw new shine.Error('File operations currently not supported.');
		},




		'type': function () {
			// Return nil
		},




		write: function () {
			var i, arg, output = '';

			for (var i in arguments) {
				if (arguments.hasOwnProperty(i)) {
					output += shine.utils.coerce(arguments[i], 'string', 'bad argument #' + i + ' to \'write\' (string expected, got %type)');
				}
			}

			shine.stdout.write(output);
		}


	});




	shine.lib.math = new shine.Table({


		abs: function (x) {
			return Math.abs(x);
		},




		acos: function (x) {
			return Math.acos(x);
		},




		asin: function (x) {
			return Math.asin(x);
		},




		atan: function (x) {
			return Math.atan(x);
		},




		atan2: function (y, x) {
			return Math.atan2(y, x);
		},




		ceil: function (x) {
			return Math.ceil(x);
		},




		cos: function (x) {
			return Math.cos(x);
		},




		cosh: function (x) {
			var e = shine.lib.math.exp;
			return (e(x) + e(-x)) / 2;
		},




		deg: function (x) {
			return x * 180 / Math.PI;
		},




		exp: function (x) {
			return Math.exp(x);
		},




		floor: function (x) {
			return Math.floor(x);
		},




		fmod: function (x, y) {
			return x % y;
		},




		frexp: function (x) {
			var delta, exponent, mantissa;
			if (x == 0) return [0, 0];

			delta = x > 0? 1 : -1;
			x = x * delta;

			exponent = Math.floor(Math.log(x) / Math.log(2)) + 1;
			mantissa = x / Math.pow(2, exponent);

			return [mantissa * delta, exponent];
		},




		huge: Infinity,




		ldexp: function (m, e) {
			return m * Math.pow(2, e);
		},




		log: function (x, base) {
			var result = Math.log(x);
			if (base !== undefined) return result / Math.log(base);
			return result;
		},




		log10: function (x) {
			// v5.2: shine.warn ('math.log10 is deprecated. Use math.log with 10 as its second argument instead.');
			return Math.log(x) / Math.log(10);
		},




		max: function () {
			return Math.max.apply(Math, arguments);
		},




		min: function () {
			return Math.min.apply(Math, arguments);
		},




		modf: function (x) {
			var intValue = Math.floor(x),
				mantissa = x - intValue;
			return [intValue, mantissa];
		},




		pi: Math.PI,




		pow: function (x, y) {
			var coerce = shine.utils.coerce;
			x = coerce(x, 'number', "bad argument #1 to 'pow' (number expected)")
			y = coerce(y, 'number', "bad argument #2 to 'pow' (number expected)")
			return Math.pow(x, y);
		},




		rad: function (x) {
			x = shine.utils.coerce(x, 'number', "bad argument #1 to 'rad' (number expected)")
			return (Math.PI / 180) * x;
		},




		/**
		 * Implementation of Lua's math.random function.
		 */
		random: function (min, max) {
			if (min === undefined && max === undefined) return getRandom();


			if (typeof min !== 'number') throw new shine.Error("bad argument #1 to 'random' (number expected)");

			if (max === undefined) {
				max = min;
				min = 1;

			} else if (typeof max !== 'number') {
				throw new shine.Error("bad argument #2 to 'random' (number expected)");
			}

			if (min > max) throw new shine.Error("bad argument #2 to 'random' (interval is empty)");
			return Math.floor(getRandom() * (max - min + 1) + min);
		},




		randomseed: function (x) {
			if (typeof x !== 'number') throw new shine.Error("bad argument #1 to 'randomseed' (number expected)");
			randomSeed = x;
		},




		sin: function (x) {
			return Math.sin(x);
		},




		sinh: function (x) {
			var e = shine.lib.math.exp;
			return (e(x) - e(-x)) / 2;
		},




		sqrt: function (x) {
			return Math.sqrt(x);
		},




		tan: function (x) {
			return Math.tan(x);
		},




		tanh: function (x) {
			var e = shine.lib.math.exp;
			return (e(x) - e(-x))/(e(x) + e(-x));
		}


	});




	shine.lib.os = new shine.Table({


		clock: function () {
			// Not implemented
		},




		date: function (format, time) {
			if (format === undefined) format = '%c';

			var utc,
				date = new Date();

			if (time) date.setTime(time * 1000);

			if (format.substr(0, 1) === '!') {
				format = format.substr(1);
				utc = true;
			}

			if (format === '*t') {
				var isDST = function (d) {
					var year = d.getFullYear(),
						jan = new Date(year, 0);

					// ASSUMPTION: If the time offset of the date is the same as it would be in January of the same year, DST is not in effect.
					return (d.getTimezoneOffset() !== jan.getTimezoneOffset());
				};

				return new shine.Table ({
					year: parseInt(DATE_FORMAT_HANDLERS['%Y'](date, utc), 10),
					month: parseInt(DATE_FORMAT_HANDLERS['%m'](date, utc), 10),
					day: parseInt(DATE_FORMAT_HANDLERS['%d'](date, utc), 10),
					hour: parseInt(DATE_FORMAT_HANDLERS['%H'](date, utc), 10),
					min: parseInt(DATE_FORMAT_HANDLERS['%M'](date, utc), 10),
					sec: parseInt(DATE_FORMAT_HANDLERS['%S'](date, utc), 10),
					wday: parseInt(DATE_FORMAT_HANDLERS['%w'](date, utc), 10) + 1,
					yday: parseInt(DATE_FORMAT_HANDLERS['%j'](date, utc), 10),
					isdst: isDST(date, utc)
				});
			}


			for (var i in DATE_FORMAT_HANDLERS) {
				if (DATE_FORMAT_HANDLERS.hasOwnProperty(i) && format.indexOf(i) >= 0) format = format.replace(i, DATE_FORMAT_HANDLERS[i](date, utc));
			}

			return format;
		},




		difftime: function (t2, t1) {
			return t2 - t1;
		},




		execute: function () {
			if (arguments.length) throw new shine.Error('shell is not available. You should always check first by calling os.execute with no parameters');
			return 0;
		},




		exit: function (code) {
			throw new shine.Error('Execution terminated [' + (code || 0) + ']');
		},




		getenv: function () {
			// Not implemented
		},




		remove: function () {
			// Not implemented
		},




		rename: function () {
			// Not implemented
		},




		setlocale: function () {
			// Not implemented
		},




		/**
		 * Implementation of Lua's os.time function.
		 * @param {object} table The table that will receive the metatable.
		 */
		time: function (table) {
			var time;

			if (!table) {
				time = Date['now']? Date['now']() : new Date().getTime();

			} else {
				var day, month, year, hour, min, sec;

				if (!(day = table.getMember('day'))) throw new shine.Error("Field 'day' missing in date table");
				if (!(month = table.getMember('month'))) throw new shine.Error("Field 'month' missing in date table");
				if (!(year = table.getMember('year'))) throw new shine.Error("Field 'year' missing in date table");
				hour = table.getMember('hour') || 12;
				min = table.getMember('min') || 0;
				sec = table.getMember('sec') || 0;

				if (table.getMember('isdst')) hour--;
				time = new Date(year, month - 1, day, hour, min, sec).getTime();
			}

			return Math.floor(time / 1000);
		},




		tmpname: function () {
			// Not implemented
		}


	});




	shine.lib['package'] = new shine.Table({

		cpath: undefined,


		loaded: new shine.Table(),


		loadlib: function (libname, funcname) {
			// Not implemented
		},


		path: '?.lua.json;?.json;modules/?.lua.json;modules/?.json;modules/?/?.lua.json;modules/?/index.lua.json',


		preload: {},


		seeall: function (module) {
			var vm = getVM(this),
				mt = new shine.Table();

			mt.setMember('__index', vm._globals);
			shine.lib.setmetatable(module, mt);
		}

	});




	shine.lib.string = new shine.Table({


		'byte': function (s, i, j) {
			i = i || 1;
			j = j || i;

			var result = shine.gc.createArray(),
				length = s.length,
				index;

			for (index = i; index <= length && index <= j ; index++) result.push(s.charCodeAt(index - 1) || undefined);
			return result;
		},




		'char': function () {
			var result = '';
			for (var i = 0, l = arguments.length; i < l; i++) result += String.fromCharCode(arguments[i]);

			return result;
		},




		dump: function (func) {
			var data = func._data,
				result = shine.gc.createObject(),
				i;

			for (i in data) {
				if (data.hasOwnProperty(i)) result[i] = data[i];
			}

			result.instructions = Array.apply(shine.gc.createArray(), result.instructions);
			return JSON.stringify(result);
		},




		find: function (s, pattern, init, plain) {
			if (typeof s != 'string' && typeof s != 'number') throw new shine.Error("bad argument #1 to 'find' (string expected, got " + typeof s + ")");
			if (typeof pattern != 'string' && typeof pattern != 'number') throw new shine.Error("bad argument #2 to 'find' (string expected, got " + typeof pattern + ")");

			s = '' + s;
			init = init || 1;

			var index, reg, match, result;

			// Regex
			if (plain === undefined || !plain) {
				pattern = translatePattern(pattern);
				reg = new RegExp(pattern);
				index = s.substr(init - 1).search(reg);

				if (index < 0) return;

				match = s.substr(init - 1).match(reg);
				result = [index + init, index + init + match[0].length - 1];

				match.shift();
				return result.concat(match);
			}

			// Plain
			index = s.indexOf(pattern, init - 1);
			return (index === -1)? undefined : [index + 1, index + pattern.length];
		},




		format: function (formatstring) {
			var FIND_PATTERN = /^((.|\s)*?)(%)((.|\s)*)$/,
				PARSE_PATTERN = /^(%?)([+\-#\ 0]*)(\d*)(\.(\d*))?([cdeEfgGiouqsxX])((.|\s)*)$/,
				findData,
				result = '',
				parseData,
				args = [].splice.call(arguments, 0),
				argIndex = 2,
				index = 2;

			args.shift();


			function parseMeta(parseData) {
				var flags = parseData[2],
					precision = parseInt(parseData[5]);

				if (('' + flags).length > 5) throw new shine.Error('invalid format (repeated flags)');
				if (!precision && precision !== 0) precision = Infinity;

				return {
					showSign: flags.indexOf('+') >= 0,
					prefix: flags.indexOf(' ') >= 0,
					leftAlign: flags.indexOf('-') >= 0,
					alternateForm: flags.indexOf('#') >= 0,
					zeroPad: flags.indexOf('0') >= 0,
					minWidth: parseInt(parseData[3]) || 0,
					hasPrecision: !!parseData[4],
					precision: precision
				};
			}


			function pad (character, len) {
				return Array(len + 1).join(character);
			}


			function padNumber (arg, neg, meta) {
				var l;

				if (meta.zeroPad && !meta.leftAlign && (l = meta.minWidth - arg.length) > 0) {
					if (neg || meta.showSign || meta.prefix) l--;
					arg = pad('0', l) + arg;
				}

				if (neg) {
					arg = '-' + arg;

				} else if (meta.showSign) {
					arg = '+' + arg;

				} else if (meta.prefix) {
					arg = ' ' + arg;
				}

				if ((l = meta.minWidth - arg.length) > 0) {
					if (meta.leftAlign) return arg + pad(' ', l);
					return pad(' ', l) + arg;
				}

				return arg;
			}


			function c (arg) {
				arg = shine.utils.coerce(arg, 'number', 'bad argument #' + argIndex + ' to \'format\' (number expected)');
				return String.fromCharCode(arg);
			}


			function d (arg) {
				arg = shine.utils.coerce(arg, 'number', 'bad argument #' + argIndex + ' to \'format\' (number expected)');

				var meta = parseMeta(parseData),
					neg = arg < 0,
					l;

				arg = '' + Math.floor(Math.abs(arg));

				if (meta.hasPrecision) {
					if (meta.precision !== Infinity && (l = meta.precision - arg.length) > 0) arg = pad('0', l) + arg;
					meta.zeroPad = false;
				}

				return padNumber(arg, neg, meta);
			}


			function f (arg) {
				arg = shine.utils.coerce(arg, 'number', 'bad argument #' + argIndex + ' to \'format\' (number expected)');

				var meta = parseMeta(parseData),
					neg = arg < 0,
					mantissa = arg - Math.floor(arg),
					precision = meta.precision === Infinity? 6 : meta.precision;

				arg = '' + Math.floor(Math.abs(arg));
				if (precision > 0) arg += '.' + Math.round(mantissa * Math.pow(10, precision));

				return padNumber(arg, neg, meta);
			}


			function o (arg, limit) {
				arg = shine.utils.coerce(arg, 'number', 'bad argument #' + argIndex + ' to \'format\' (number expected)');

				var neg = arg < 0,
					limit = Math.pow(2, 32),
					meta = parseMeta(parseData),
					l;

				arg = Math.floor(arg);
				if (neg) arg = limit + arg;

				arg = arg.toString(16);
				//if (neg && intSize > 2) arg = ;
				if (meta.hasPrecision && meta.precision !== Infinity && (l = meta.precision - arg.length) > 0) arg = pad('0', l) + arg;

				if ((l = meta.minWidth - arg.length) > 0) {
					if (meta.leftAlign) return arg + pad(' ', l);
					return pad(' ', l) + arg;
				}

				return arg;
			}


			function q (arg) {
				arg = shine.utils.coerce(arg, 'string');
				return '"' + arg.replace(/([\n"])/g, '\\$1') + '"';
			}


			function s (arg) {
				var meta = parseMeta(parseData),
					l;

				arg = shine.utils.coerce(arg, 'string');
				arg = arg.substr(0, meta.precision);

				if ((l = meta.minWidth - arg.length) > 0) {
					if (meta.leftAlign) {
						return arg + pad(' ', l);
					} else {
						return pad(meta.zeroPad? '0' : ' ', l) + arg;
					}
				}

				return arg;
			}


			function x (arg) {
				arg = shine.utils.coerce(arg, 'number', 'bad argument #' + argIndex + ' to \'format\' (number expected)');

				var neg = arg < 0,
					intSize = 4, //vm && vm._thread && vm._thread._file.data.meta && vm._thread._file.data.meta.sizes.int || 4,
					limit = Math.pow(2, 32),
					meta = parseMeta(parseData),
					l;

				arg = Math.floor(arg);
				if (neg) arg = limit + arg;

				arg = arg.toString(16);
				if (neg && intSize > 2) arg = pad('f', (intSize - 2) * 4) + arg;
				if (meta.hasPrecision && meta.precision !== Infinity && (l = meta.precision - arg.length) > 0) arg = pad('0', l) + arg;

				if (meta.alternateForm) arg = '0x' + arg;

				// if ((l = meta.minWidth - arg.length) > 0) {
				// 	if (meta.leftAlign) return arg + pad(' ', l);
				// 	return pad(' ', l) + arg;
				// }

				meta.showSign = meta.prefix = false;
				meta.zeroPad = meta.zeroPad && meta.hasPrecision;
				arg = padNumber(arg, false, meta);

				return arg;
			}



			while (findData = ('' + formatstring).match(FIND_PATTERN)) {
				result += findData[1];
				while (findData[index] != '%') index++;
				parseData = ('' + findData[index + 1]).match(PARSE_PATTERN);

				if (parseData[1]) {
					// %%
					result += '%' + parseData[2] + parseData[3] + (parseData[4] || '') + parseData[6];

				} else {
					switch(parseData[6]) {

						case 'c':
							result += c(args.shift());
							break;

						case 'd':
							result += d(args.shift());
							break;

						case 'f':
							result += f(args.shift());
							break;

						case 'q':
							result += q(args.shift());
							break;

						case 'o':
							result += o(args.shift());
							break;

						case 's':
							result += s(args.shift());
							break;

						case 'x':
							result += x(args.shift());
							break;

						case 'X':
							result += x(args.shift()).toUpperCase();
							break;

					}
				}

				formatstring = parseData[7];
				argIndex++;
			}

			return result + formatstring;
		},




		gmatch: function (s, pattern) {
			pattern = translatePattern(pattern);
			var reg = new RegExp(pattern, 'g'),
				matches = ('' + s).match(reg);

			return function () {
				var match = matches.shift(),
					groups = new RegExp(pattern).exec(match);

				if (match === undefined) return;

				groups.shift();
				return groups.length? groups : match;
			};
		},




		gsub: function (s, pattern, repl, n) {
			if (typeof s != 'string' && typeof s != 'number') throw new shine.Error("bad argument #1 to 'gsub' (string expected, got " + typeof s + ")");
			if (typeof pattern != 'string' && typeof pattern != 'number') throw new shine.Error("bad argument #2 to 'gsub' (string expected, got " + typeof pattern + ")");
			if (n !== undefined && (n = shine.utils.coerce(n, 'number')) === undefined) throw new shine.Error("bad argument #4 to 'gsub' (number expected, got " + typeof n + ")");

			s = '' + s;
			pattern = translatePattern('' + pattern);

			var count = 0,
				result = '',
				str,
				prefix,
				match,
				lastMatch;

			while ((n === undefined || count < n) && s && (match = s.match(pattern))) {

				if (typeof repl == 'function' || (repl || shine.EMPTY_OBJ) instanceof shine.Function) {
					str = repl.apply(null, [match[0]], true);
					if (str instanceof Array) str = str[0];
					if (str === undefined) str = match[0];

				} else if ((repl || shine.EMPTY_OBJ) instanceof shine.Table) {
					str = repl.getMember(match[0]);

				} else if (typeof repl == 'object') {
					str = repl[match];

				} else {
					str = ('' + repl).replace(/%([0-9])/g, function (m, i) { return match[i]; });
				}

				if (match[0].length == 0 && lastMatch === undefined) {
				 	prefix = '';
				} else {
					prefix = s.split(match[0], 1)[0];
				}

				lastMatch = match[0];
				result += prefix + str;
				s = s.substr((prefix + lastMatch).length);

				count++;
			}

			return [result + s, count];
		},




		len: function (s) {
			// if (typeof s != 'string' && typeof s != 'number') throw new shine.Error("bad argument #1 to 'len' (string expected, got " + typeof s + ")");
			s = shine.utils.coerce(s, 'string', "bad argument #1 to 'len' (string expected, got %type)");
			return s.length;
		},




		lower: function (s) {
			if (typeof s != 'string' && typeof s != 'number') throw new shine.Error("bad argument #1 to 'lower' (string expected, got " + typeof s + ")");
			return ('' + s).toLowerCase();
		},




		match: function (s, pattern, init) {
			if (typeof s != 'string' && typeof s != 'number') throw new shine.Error("bad argument #1 to 'match' (string expected, got " + typeof s + ")");
			if (typeof pattern != 'string' && typeof pattern != 'number') throw new shine.Error("bad argument #2 to 'match' (string expected, got " + typeof pattern + ")");

			init = init? init - 1 : 0;
			s = ('' + s).substr(init);

			var matches = s.match(new RegExp(translatePattern (pattern)));

			if (!matches) return;
			if (!matches[1]) return matches[0];

			matches.shift();
			return matches;
		},




		rep: function (s, n) {
			var result = '',
			i;

			for (i = 0; i < n; i++) result += s;
			return result;
		},




		reverse: function (s) {
			var result = '',
			i;

			for (i = s.length; i >= 0; i--) result += s.charAt(i);
			return result;
		},




		sub: function (s, i, j) {
			if (typeof s != 'string' && typeof s != 'number') throw new shine.Error("Bad argument #1 to 'sub' (string expected, got " + typeof s + ")");
			s = '' + s;
			i = i || 1;
			j = j || s.length;

			if (i > 0) {
				i = i - 1;
			} else if (i < 0) {
				i = s.length + i;
			}

			if (j < 0) j = s.length + j + 1;

			return s.substring(i, j);
		},




		upper: function (s) {
			return s.toUpperCase();
		}


	});


	stringMetatable = new shine.Table({ __index: shine.lib.string });




	shine.lib.table = new shine.Table({


		concat: function (table, sep, i, j) {
			if (!((table || shine.EMPTY_OBJ) instanceof shine.Table)) throw new shine.Error("Bad argument #1 to 'concat' (table expected)");

			sep = sep || '';
			i = i || 1;
			j = j || shine.lib.table.maxn(table);

			var result = shine.gc.createArray().concat(table.__shine.numValues).splice(i, j - i + 1);
			return result.join(sep);
		},




		getn: function (table) {
			if (!((table || shine.EMPTY_OBJ) instanceof shine.Table)) throw new shine.Error("Bad argument #1 in 'getn' (table expected)");

			var vals = table.__shine.numValues,
				keys = shine.gc.createArray(),
				i,
				j = 0;

			for (i in vals) if (vals.hasOwnProperty(i)) keys[i] = true;
			while (keys[j + 1]) j++;

			// Following translated from ltable.c (http://www.lua.org/source/5.1/ltable.c.html)
			if (j > 0 && vals[j] === undefined) {
				/* there is a boundary in the array part: (binary) search for it */
				var i = 0;

				while (j - i > 1) {
					var m = Math.floor((i + j) / 2);

					if (vals[m] === undefined) {
						j = m;
					} else {
						i = m;
					}
				}

				return i;
			}

			return j;
		},




		/**
		 * Implementation of Lua's table.insert function.
		 * @param {object} table The table in which to insert.
		 * @param {object} index The poostion to insert.
		 * @param {object} obj The value to insert.
		 */
		insert: function (table, index, obj) {
			if (!((table || shine.EMPTY_OBJ) instanceof shine.Table)) throw new shine.Error('Bad argument #1 in table.insert(). Table expected');

			if (obj == undefined) {
				obj = index;
				index = table.__shine.numValues.length;
			} else {
				index = shine.utils.coerce(index, 'number', "Bad argument #2 to 'insert' (number expected)");
			}

			table.__shine.numValues.splice(index, 0, undefined);
			table.setMember(index, obj);
		},




		maxn: function (table) {
			// v5.2: shine.warn ('table.maxn is deprecated');

			if (!((table || shine.EMPTY_OBJ) instanceof shine.Table)) throw new shine.Error("Bad argument #1 to 'maxn' (table expected)");

			// // length = 0;
			// // while (table[length + 1] != undefined) length++;
			// //
			// // return length;

			// var result = 0,
			// 	index,
			// 	i;

			// for (i in table) if ((index = 0 + parseInt (i, 10)) == i && table[i] !== null && index > result) result = index;
			// return result;

			return table.__shine.numValues.length - 1;
		},




		/**
		 * Implementation of Lua's table.remove function.
		 * @param {object} table The table from which to remove an element.
		 * @param {object} index The position of the element to remove.
		 */
		remove: function (table, index) {
			if (!((table || shine.EMPTY_OBJ) instanceof shine.Table)) throw new shine.Error('Bad argument #1 in table.remove(). Table expected');

			var max = shine.lib.table.getn(table),
				vals = table.__shine.numValues,
				result;

			if (index > max) return;
			if (index == undefined) index = max;

			result = vals.splice(index, 1);
			while (index < max && vals[index] === undefined) delete vals[index++];

			return result;
		},




		sort: function (table, comp) {
			if (!((table || shine.EMPTY_OBJ) instanceof shine.Table)) throw new shine.Error("Bad argument #1 to 'sort' (table expected)");

			var sortFunc,
				arr = table.__shine.numValues;

			if (comp) {
				if (!((comp || shine.EMPTY_OBJ) instanceof shine.Function)) throw new shine.Error("Bad argument #2 to 'sort' (function expected)");

				sortFunc = function (a, b) {
					return comp.apply(null, [a, b], true)[0]? -1 : 1;
				}

			} else {
				sortFunc = function (a, b) {
					return a < b? -1 : 1;
				};
			}

			arr.shift();
			arr.sort(sortFunc).unshift(undefined);
		},




		unpack: function (table, i, j) {
			if (!((table || shine.EMPTY_OBJ) instanceof shine.Table)) throw new shine.Error("Bad argument #1 to 'unpack' (table expected)");

			i = i || 1;
			if (j === undefined) j = shine.lib.table.getn(table);

			var vals = shine.gc.createArray(),
				index;

			for (index = i; index <= j; index++) vals.push(table.getMember(index));
			return vals;
		}


	});


})();




// vm/src/utils.js:


'use strict';


var shine = shine || {};


(function () {
	/**
	 * Pattern to identify a string value that can validly be converted to a number in Lua.
	 * @type RegExp
	 * @private
	 * @constant
	 */
	var FLOATING_POINT_PATTERN = /^[-+]?[0-9]*\.?([0-9]+([eE][-+]?[0-9]+)?)?$/,




		HEXIDECIMAL_CONSTANT_PATTERN = /^(\-)?0x([0-9a-fA-F]*)\.?([0-9a-fA-F]*)$/;






// vm/src/utils.js:

	shine.utils = {


		/**
		 * Coerces a value from its current type to another type in the same manner as Lua.
		 * @param {Object} val The value to be converted.
		 * @param {String} type The type to which to convert. Possible values: 'boolean', 'string', number'.
		 * @param {String} [error] The error message to throw if the conversion fails.
		 * @returns {Object} The converted value.
		 */
		coerce: function (val, type, errorMessage) {
			var n, match, mantissa;

			function error () {
				if (!errorMessage) return;
				errorMessage = ('' + errorMessage).replace(/\%type/gi, shine.lib.type(val));
				throw new shine.Error(errorMessage);
			}

			switch (type) {
				case 'boolean':
					return !(val === false || val === undefined);

				case 'string':
					switch(true) {
						case typeof val == 'string': return val;

						case val === undefined:
						case val === null:
							return 'nil';

						case val === Infinity: return 'inf';
						case val === -Infinity: return '-inf';

						case typeof val == 'number':
						case typeof val == 'boolean':
							return window.isNaN(val)? 'nan' : '' + val;

						default: return error() || '';
					}

				case 'number':
					switch (true) {
						case typeof val == 'number': return val;
						case val === undefined: return;
						case val === 'inf': return Infinity;
						case val === '-inf': return -Infinity;
						case val === 'nan': return NaN;

						default:
							if (('' + val).match(FLOATING_POINT_PATTERN)) {
								n = parseFloat(val);

							} else if (match = ('' + val).match(HEXIDECIMAL_CONSTANT_PATTERN)) {
								mantissa = match[3];

								if ((n = match[2]) || mantissa) {
									n = parseInt(n, 16) || 0;
									if (mantissa) n += parseInt(mantissa, 16) / Math.pow(16, mantissa.length);
									if (match[1]) n *= -1;
								}
							}

							if (n === undefined) error();
							return n;
					}

				default:
					throw new ReferenceError('Can not coerce to type: ' + type);
			}
		},




		/**
		 * Converts a Lua table and all of its nested properties to a JavaScript objects or arrays.
		 * @param {shine.Table} table The Lua table object.
		 * @returns {Object} The converted object.
		 */
		toObject: function (table) {
			var isArr = shine.lib.table.getn (table) > 0,
				result = shine.gc['create' + (isArr? 'Array' : 'Object')](),
				numValues = table.__shine.numValues,
				i,
				l = numValues.length;

			for (i = 1; i < l; i++) {
				result[i - 1] = ((numValues[i] || shine.EMPTY_OBJ) instanceof shine.Table)? shine.utils.toObject(numValues[i]) : numValues[i];
			}

			for (i in table) {
				if (table.hasOwnProperty(i) && !(i in shine.Table.prototype) && i !== '__shine') {
					result[i] = ((table[i] || shine.EMPTY_OBJ) instanceof shine.Table)? shine.utils.toObject(table[i]) : table[i];
				}
			}

			return result;
		},




		/**
		 * Parses a JSON string to a table.
		 * @param {String} json The JSON string.
		 * @returns {shine.Table} The resulting table.
		 */
		parseJSON: function (json) {

			var convertToTable = function (obj) {
				for (var i in obj) {
					if (obj.hasOwnProperty(i)) {
						if (typeof obj[i] === 'object') {
							obj[i] = convertToTable(obj[i]);

						} else if (obj[i] === null) {
							obj[i] = undefined;
						}
					}
				}

				return new shine.Table(obj);
			};

			return convertToTable(JSON.parse(json));
		},




		/**
		 * Makes an HTTP GET request.
		 * @param {String} url The URL to request.
		 * @param {Function} success The callback to be executed upon a successful outcome.
		 * @param {Function} error The callback to be executed upon an unsuccessful outcome.
		 */
		get: function (url, success, error) {
			var xhr = new XMLHttpRequest(),
				parse;

			xhr.open('GET', url, true);


			// Use ArrayBuffer where possible. Luac files do not load properly with 'text'.
			if ('ArrayBuffer' in window) {
				xhr.responseType = 'arraybuffer';

				parse = function (data) {
					// There is a limit on the number of arguments one can pass to a function. So far iPad is the lowest, and 10000 is safe.
					// If safe number of arguments to pass to fromCharCode:
					if (data.byteLength <= 10000) return String.fromCharCode.apply(String, Array.prototype.slice.call(new Uint8Array(data)));

					// otherwise break up bytearray:
					var i, l,
						arr = new Uint8Array(data),
						result = '';

					for (i = 0, l = data.byteLength; i < l; i += 10000) {
						result += String.fromCharCode.apply(String, Array.prototype.slice.call(arr.subarray(i, Math.min(i + 10000, l))));
					}

					return result;
				};

			} else {
				xhr.responseType = 'text';
				parse = function (data) { return data; };
			}


			xhr.onload = function (e) {
				if (this.status == 200) {
					if (success) success(parse(this.response));
				} else {
					if (error) error(this.status);
				}
			}

			xhr.send(shine.EMPTY_OBJ);
	    }


	};


})();




// vm/src/output.js:



'use strict';


var shine = shine || {};




// Standard output
shine.stdout = {};

shine.stdout.write = function (message) {
	// Overwrite this in host application
	if (console && console.log) {
		console.log(message);
	} else if (trace) {
		trace(message);
	}
};




// Standard debug output
shine.stddebug = {};

shine.stddebug.write = function (message) {
	// Moonshine bytecode debugging output
};




// Standard error output
shine.stderr = {};

shine.stderr.write = function (message, level) {
	level = level || 'error';
	if (console && console[level]) console[level](message);
};

;var module = module; if (typeof module != 'undefined') module.exports = shine;

// === Sylvester ===
// Vector and Matrix mathematics modules for JavaScript
// Copyright (c) 2007 James Coglan
// 
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the "Software"),
// to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense,
// and/or sell copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
// THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.

var Sylvester = {
  version: '0.1.3',
  precision: 1e-6
};

function Vector() {}
Vector.prototype = {

  // Returns element i of the vector
  e: function(i) {
    return (i < 1 || i > this.elements.length) ? null : this.elements[i-1];
  },

  // Returns the number of elements the vector has
  dimensions: function() {
    return this.elements.length;
  },

  // Returns the modulus ('length') of the vector
  modulus: function() {
    return Math.sqrt(this.dot(this));
  },

  // Returns true iff the vector is equal to the argument
  eql: function(vector) {
    var n = this.elements.length;
    var V = vector.elements || vector;
    if (n != V.length) { return false; }
    do {
      if (Math.abs(this.elements[n-1] - V[n-1]) > Sylvester.precision) { return false; }
    } while (--n);
    return true;
  },

  // Returns a copy of the vector
  dup: function() {
    return Vector.create(this.elements);
  },

  // Maps the vector to another vector according to the given function
  map: function(fn) {
    var elements = [];
    this.each(function(x, i) {
      elements.push(fn(x, i));
    });
    return Vector.create(elements);
  },
  
  // Calls the iterator for each element of the vector in turn
  each: function(fn) {
    var n = this.elements.length, k = n, i;
    do { i = k - n;
      fn(this.elements[i], i+1);
    } while (--n);
  },

  // Returns a new vector created by normalizing the receiver
  toUnitVector: function() {
    var r = this.modulus();
    if (r === 0) { return this.dup(); }
    return this.map(function(x) { return x/r; });
  },

  // Returns the angle between the vector and the argument (also a vector)
  angleFrom: function(vector) {
    var V = vector.elements || vector;
    var n = this.elements.length, k = n, i;
    if (n != V.length) { return null; }
    var dot = 0, mod1 = 0, mod2 = 0;
    // Work things out in parallel to save time
    this.each(function(x, i) {
      dot += x * V[i-1];
      mod1 += x * x;
      mod2 += V[i-1] * V[i-1];
    });
    mod1 = Math.sqrt(mod1); mod2 = Math.sqrt(mod2);
    if (mod1*mod2 === 0) { return null; }
    var theta = dot / (mod1*mod2);
    if (theta < -1) { theta = -1; }
    if (theta > 1) { theta = 1; }
    return Math.acos(theta);
  },

  // Returns true iff the vector is parallel to the argument
  isParallelTo: function(vector) {
    var angle = this.angleFrom(vector);
    return (angle === null) ? null : (angle <= Sylvester.precision);
  },

  // Returns true iff the vector is antiparallel to the argument
  isAntiparallelTo: function(vector) {
    var angle = this.angleFrom(vector);
    return (angle === null) ? null : (Math.abs(angle - Math.PI) <= Sylvester.precision);
  },

  // Returns true iff the vector is perpendicular to the argument
  isPerpendicularTo: function(vector) {
    var dot = this.dot(vector);
    return (dot === null) ? null : (Math.abs(dot) <= Sylvester.precision);
  },

  // Returns the result of adding the argument to the vector
  add: function(vector) {
    var V = vector.elements || vector;
    if (this.elements.length != V.length) { return null; }
    return this.map(function(x, i) { return x + V[i-1]; });
  },

  // Returns the result of subtracting the argument from the vector
  subtract: function(vector) {
    var V = vector.elements || vector;
    if (this.elements.length != V.length) { return null; }
    return this.map(function(x, i) { return x - V[i-1]; });
  },

  // Returns the result of multiplying the elements of the vector by the argument
  multiply: function(k) {
    return this.map(function(x) { return x*k; });
  },

  x: function(k) { return this.multiply(k); },

  // Returns the scalar product of the vector with the argument
  // Both vectors must have equal dimensionality
  dot: function(vector) {
    var V = vector.elements || vector;
    var i, product = 0, n = this.elements.length;
    if (n != V.length) { return null; }
    do { product += this.elements[n-1] * V[n-1]; } while (--n);
    return product;
  },

  // Returns the vector product of the vector with the argument
  // Both vectors must have dimensionality 3
  cross: function(vector) {
    var B = vector.elements || vector;
    if (this.elements.length != 3 || B.length != 3) { return null; }
    var A = this.elements;
    return Vector.create([
      (A[1] * B[2]) - (A[2] * B[1]),
      (A[2] * B[0]) - (A[0] * B[2]),
      (A[0] * B[1]) - (A[1] * B[0])
    ]);
  },

  // Returns the (absolute) largest element of the vector
  max: function() {
    var m = 0, n = this.elements.length, k = n, i;
    do { i = k - n;
      if (Math.abs(this.elements[i]) > Math.abs(m)) { m = this.elements[i]; }
    } while (--n);
    return m;
  },

  // Returns the index of the first match found
  indexOf: function(x) {
    var index = null, n = this.elements.length, k = n, i;
    do { i = k - n;
      if (index === null && this.elements[i] == x) {
        index = i + 1;
      }
    } while (--n);
    return index;
  },

  // Returns a diagonal matrix with the vector's elements as its diagonal elements
  toDiagonalMatrix: function() {
    return Matrix.Diagonal(this.elements);
  },

  // Returns the result of rounding the elements of the vector
  round: function() {
    return this.map(function(x) { return Math.round(x); });
  },

  // Returns a copy of the vector with elements set to the given value if they
  // differ from it by less than Sylvester.precision
  snapTo: function(x) {
    return this.map(function(y) {
      return (Math.abs(y - x) <= Sylvester.precision) ? x : y;
    });
  },

  // Returns the vector's distance from the argument, when considered as a point in space
  distanceFrom: function(obj) {
    if (obj.anchor) { return obj.distanceFrom(this); }
    var V = obj.elements || obj;
    if (V.length != this.elements.length) { return null; }
    var sum = 0, part;
    this.each(function(x, i) {
      part = x - V[i-1];
      sum += part * part;
    });
    return Math.sqrt(sum);
  },

  // Returns true if the vector is point on the given line
  liesOn: function(line) {
    return line.contains(this);
  },

  // Return true iff the vector is a point in the given plane
  liesIn: function(plane) {
    return plane.contains(this);
  },

  // Rotates the vector about the given object. The object should be a 
  // point if the vector is 2D, and a line if it is 3D. Be careful with line directions!
  rotate: function(t, obj) {
    var V, R, x, y, z;
    switch (this.elements.length) {
      case 2:
        V = obj.elements || obj;
        if (V.length != 2) { return null; }
        R = Matrix.Rotation(t).elements;
        x = this.elements[0] - V[0];
        y = this.elements[1] - V[1];
        return Vector.create([
          V[0] + R[0][0] * x + R[0][1] * y,
          V[1] + R[1][0] * x + R[1][1] * y
        ]);
        break;
      case 3:
        if (!obj.direction) { return null; }
        var C = obj.pointClosestTo(this).elements;
        R = Matrix.Rotation(t, obj.direction).elements;
        x = this.elements[0] - C[0];
        y = this.elements[1] - C[1];
        z = this.elements[2] - C[2];
        return Vector.create([
          C[0] + R[0][0] * x + R[0][1] * y + R[0][2] * z,
          C[1] + R[1][0] * x + R[1][1] * y + R[1][2] * z,
          C[2] + R[2][0] * x + R[2][1] * y + R[2][2] * z
        ]);
        break;
      default:
        return null;
    }
  },

  // Returns the result of reflecting the point in the given point, line or plane
  reflectionIn: function(obj) {
    if (obj.anchor) {
      // obj is a plane or line
      var P = this.elements.slice();
      var C = obj.pointClosestTo(P).elements;
      return Vector.create([C[0] + (C[0] - P[0]), C[1] + (C[1] - P[1]), C[2] + (C[2] - (P[2] || 0))]);
    } else {
      // obj is a point
      var Q = obj.elements || obj;
      if (this.elements.length != Q.length) { return null; }
      return this.map(function(x, i) { return Q[i-1] + (Q[i-1] - x); });
    }
  },

  // Utility to make sure vectors are 3D. If they are 2D, a zero z-component is added
  to3D: function() {
    var V = this.dup();
    switch (V.elements.length) {
      case 3: break;
      case 2: V.elements.push(0); break;
      default: return null;
    }
    return V;
  },

  // Returns a string representation of the vector
  inspect: function() {
    return '[' + this.elements.join(', ') + ']';
  },

  // Set vector's elements from an array
  setElements: function(els) {
    this.elements = (els.elements || els).slice();
    return this;
  }
};
  
// Constructor function
Vector.create = function(elements) {
  var V = new Vector();
  return V.setElements(elements);
};

// i, j, k unit vectors
Vector.i = Vector.create([1,0,0]);
Vector.j = Vector.create([0,1,0]);
Vector.k = Vector.create([0,0,1]);

// Random vector of size n
Vector.Random = function(n) {
  var elements = [];
  do { elements.push(Math.random());
  } while (--n);
  return Vector.create(elements);
};

// Vector filled with zeros
Vector.Zero = function(n) {
  var elements = [];
  do { elements.push(0);
  } while (--n);
  return Vector.create(elements);
};



function Matrix() {}
Matrix.prototype = {

  // Returns element (i,j) of the matrix
  e: function(i,j) {
    if (i < 1 || i > this.elements.length || j < 1 || j > this.elements[0].length) { return null; }
    return this.elements[i-1][j-1];
  },

  // Returns row k of the matrix as a vector
  row: function(i) {
    if (i > this.elements.length) { return null; }
    return Vector.create(this.elements[i-1]);
  },

  // Returns column k of the matrix as a vector
  col: function(j) {
    if (j > this.elements[0].length) { return null; }
    var col = [], n = this.elements.length, k = n, i;
    do { i = k - n;
      col.push(this.elements[i][j-1]);
    } while (--n);
    return Vector.create(col);
  },

  // Returns the number of rows/columns the matrix has
  dimensions: function() {
    return {rows: this.elements.length, cols: this.elements[0].length};
  },

  // Returns the number of rows in the matrix
  rows: function() {
    return this.elements.length;
  },

  // Returns the number of columns in the matrix
  cols: function() {
    return this.elements[0].length;
  },

  // Returns true iff the matrix is equal to the argument. You can supply
  // a vector as the argument, in which case the receiver must be a
  // one-column matrix equal to the vector.
  eql: function(matrix) {
    var M = matrix.elements || matrix;
    if (typeof(M[0][0]) == 'undefined') { M = Matrix.create(M).elements; }
    if (this.elements.length != M.length ||
        this.elements[0].length != M[0].length) { return false; }
    var ni = this.elements.length, ki = ni, i, nj, kj = this.elements[0].length, j;
    do { i = ki - ni;
      nj = kj;
      do { j = kj - nj;
        if (Math.abs(this.elements[i][j] - M[i][j]) > Sylvester.precision) { return false; }
      } while (--nj);
    } while (--ni);
    return true;
  },

  // Returns a copy of the matrix
  dup: function() {
    return Matrix.create(this.elements);
  },

  // Maps the matrix to another matrix (of the same dimensions) according to the given function
  map: function(fn) {
    var els = [], ni = this.elements.length, ki = ni, i, nj, kj = this.elements[0].length, j;
    do { i = ki - ni;
      nj = kj;
      els[i] = [];
      do { j = kj - nj;
        els[i][j] = fn(this.elements[i][j], i + 1, j + 1);
      } while (--nj);
    } while (--ni);
    return Matrix.create(els);
  },

  // Returns true iff the argument has the same dimensions as the matrix
  isSameSizeAs: function(matrix) {
    var M = matrix.elements || matrix;
    if (typeof(M[0][0]) == 'undefined') { M = Matrix.create(M).elements; }
    return (this.elements.length == M.length &&
        this.elements[0].length == M[0].length);
  },

  // Returns the result of adding the argument to the matrix
  add: function(matrix) {
    var M = matrix.elements || matrix;
    if (typeof(M[0][0]) == 'undefined') { M = Matrix.create(M).elements; }
    if (!this.isSameSizeAs(M)) { return null; }
    return this.map(function(x, i, j) { return x + M[i-1][j-1]; });
  },

  // Returns the result of subtracting the argument from the matrix
  subtract: function(matrix) {
    var M = matrix.elements || matrix;
    if (typeof(M[0][0]) == 'undefined') { M = Matrix.create(M).elements; }
    if (!this.isSameSizeAs(M)) { return null; }
    return this.map(function(x, i, j) { return x - M[i-1][j-1]; });
  },

  // Returns true iff the matrix can multiply the argument from the left
  canMultiplyFromLeft: function(matrix) {
    var M = matrix.elements || matrix;
    if (typeof(M[0][0]) == 'undefined') { M = Matrix.create(M).elements; }
    // this.columns should equal matrix.rows
    return (this.elements[0].length == M.length);
  },

  // Returns the result of multiplying the matrix from the right by the argument.
  // If the argument is a scalar then just multiply all the elements. If the argument is
  // a vector, a vector is returned, which saves you having to remember calling
  // col(1) on the result.
  multiply: function(matrix) {
    if (!matrix.elements) {
      return this.map(function(x) { return x * matrix; });
    }
    var returnVector = matrix.modulus ? true : false;
    var M = matrix.elements || matrix;
    if (typeof(M[0][0]) == 'undefined') { M = Matrix.create(M).elements; }
    if (!this.canMultiplyFromLeft(M)) { return null; }
    var ni = this.elements.length, ki = ni, i, nj, kj = M[0].length, j;
    var cols = this.elements[0].length, elements = [], sum, nc, c;
    do { i = ki - ni;
      elements[i] = [];
      nj = kj;
      do { j = kj - nj;
        sum = 0;
        nc = cols;
        do { c = cols - nc;
          sum += this.elements[i][c] * M[c][j];
        } while (--nc);
        elements[i][j] = sum;
      } while (--nj);
    } while (--ni);
    var M = Matrix.create(elements);
    return returnVector ? M.col(1) : M;
  },

  x: function(matrix) { return this.multiply(matrix); },

  // Returns a submatrix taken from the matrix
  // Argument order is: start row, start col, nrows, ncols
  // Element selection wraps if the required index is outside the matrix's bounds, so you could
  // use this to perform row/column cycling or copy-augmenting.
  minor: function(a, b, c, d) {
    var elements = [], ni = c, i, nj, j;
    var rows = this.elements.length, cols = this.elements[0].length;
    do { i = c - ni;
      elements[i] = [];
      nj = d;
      do { j = d - nj;
        elements[i][j] = this.elements[(a+i-1)%rows][(b+j-1)%cols];
      } while (--nj);
    } while (--ni);
    return Matrix.create(elements);
  },

  // Returns the transpose of the matrix
  transpose: function() {
    var rows = this.elements.length, cols = this.elements[0].length;
    var elements = [], ni = cols, i, nj, j;
    do { i = cols - ni;
      elements[i] = [];
      nj = rows;
      do { j = rows - nj;
        elements[i][j] = this.elements[j][i];
      } while (--nj);
    } while (--ni);
    return Matrix.create(elements);
  },

  // Returns true iff the matrix is square
  isSquare: function() {
    return (this.elements.length == this.elements[0].length);
  },

  // Returns the (absolute) largest element of the matrix
  max: function() {
    var m = 0, ni = this.elements.length, ki = ni, i, nj, kj = this.elements[0].length, j;
    do { i = ki - ni;
      nj = kj;
      do { j = kj - nj;
        if (Math.abs(this.elements[i][j]) > Math.abs(m)) { m = this.elements[i][j]; }
      } while (--nj);
    } while (--ni);
    return m;
  },

  // Returns the indeces of the first match found by reading row-by-row from left to right
  indexOf: function(x) {
    var index = null, ni = this.elements.length, ki = ni, i, nj, kj = this.elements[0].length, j;
    do { i = ki - ni;
      nj = kj;
      do { j = kj - nj;
        if (this.elements[i][j] == x) { return {i: i+1, j: j+1}; }
      } while (--nj);
    } while (--ni);
    return null;
  },

  // If the matrix is square, returns the diagonal elements as a vector.
  // Otherwise, returns null.
  diagonal: function() {
    if (!this.isSquare) { return null; }
    var els = [], n = this.elements.length, k = n, i;
    do { i = k - n;
      els.push(this.elements[i][i]);
    } while (--n);
    return Vector.create(els);
  },

  // Make the matrix upper (right) triangular by Gaussian elimination.
  // This method only adds multiples of rows to other rows. No rows are
  // scaled up or switched, and the determinant is preserved.
  toRightTriangular: function() {
    var M = this.dup(), els;
    var n = this.elements.length, k = n, i, np, kp = this.elements[0].length, p;
    do { i = k - n;
      if (M.elements[i][i] == 0) {
        for (j = i + 1; j < k; j++) {
          if (M.elements[j][i] != 0) {
            els = []; np = kp;
            do { p = kp - np;
              els.push(M.elements[i][p] + M.elements[j][p]);
            } while (--np);
            M.elements[i] = els;
            break;
          }
        }
      }
      if (M.elements[i][i] != 0) {
        for (j = i + 1; j < k; j++) {
          var multiplier = M.elements[j][i] / M.elements[i][i];
          els = []; np = kp;
          do { p = kp - np;
            // Elements with column numbers up to an including the number
            // of the row that we're subtracting can safely be set straight to
            // zero, since that's the point of this routine and it avoids having
            // to loop over and correct rounding errors later
            els.push(p <= i ? 0 : M.elements[j][p] - M.elements[i][p] * multiplier);
          } while (--np);
          M.elements[j] = els;
        }
      }
    } while (--n);
    return M;
  },

  toUpperTriangular: function() { return this.toRightTriangular(); },

  // Returns the determinant for square matrices
  determinant: function() {
    if (!this.isSquare()) { return null; }
    var M = this.toRightTriangular();
    var det = M.elements[0][0], n = M.elements.length - 1, k = n, i;
    do { i = k - n + 1;
      det = det * M.elements[i][i];
    } while (--n);
    return det;
  },

  det: function() { return this.determinant(); },

  // Returns true iff the matrix is singular
  isSingular: function() {
    return (this.isSquare() && this.determinant() === 0);
  },

  // Returns the trace for square matrices
  trace: function() {
    if (!this.isSquare()) { return null; }
    var tr = this.elements[0][0], n = this.elements.length - 1, k = n, i;
    do { i = k - n + 1;
      tr += this.elements[i][i];
    } while (--n);
    return tr;
  },

  tr: function() { return this.trace(); },

  // Returns the rank of the matrix
  rank: function() {
    var M = this.toRightTriangular(), rank = 0;
    var ni = this.elements.length, ki = ni, i, nj, kj = this.elements[0].length, j;
    do { i = ki - ni;
      nj = kj;
      do { j = kj - nj;
        if (Math.abs(M.elements[i][j]) > Sylvester.precision) { rank++; break; }
      } while (--nj);
    } while (--ni);
    return rank;
  },
  
  rk: function() { return this.rank(); },

  // Returns the result of attaching the given argument to the right-hand side of the matrix
  augment: function(matrix) {
    var M = matrix.elements || matrix;
    if (typeof(M[0][0]) == 'undefined') { M = Matrix.create(M).elements; }
    var T = this.dup(), cols = T.elements[0].length;
    var ni = T.elements.length, ki = ni, i, nj, kj = M[0].length, j;
    if (ni != M.length) { return null; }
    do { i = ki - ni;
      nj = kj;
      do { j = kj - nj;
        T.elements[i][cols + j] = M[i][j];
      } while (--nj);
    } while (--ni);
    return T;
  },

  // Returns the inverse (if one exists) using Gauss-Jordan
  inverse: function() {
    if (!this.isSquare() || this.isSingular()) { return null; }
    var ni = this.elements.length, ki = ni, i, j;
    var M = this.augment(Matrix.I(ni)).toRightTriangular();
    var np, kp = M.elements[0].length, p, els, divisor;
    var inverse_elements = [], new_element;
    // Matrix is non-singular so there will be no zeros on the diagonal
    // Cycle through rows from last to first
    do { i = ni - 1;
      // First, normalise diagonal elements to 1
      els = []; np = kp;
      inverse_elements[i] = [];
      divisor = M.elements[i][i];
      do { p = kp - np;
        new_element = M.elements[i][p] / divisor;
        els.push(new_element);
        // Shuffle of the current row of the right hand side into the results
        // array as it will not be modified by later runs through this loop
        if (p >= ki) { inverse_elements[i].push(new_element); }
      } while (--np);
      M.elements[i] = els;
      // Then, subtract this row from those above it to
      // give the identity matrix on the left hand side
      for (j = 0; j < i; j++) {
        els = []; np = kp;
        do { p = kp - np;
          els.push(M.elements[j][p] - M.elements[i][p] * M.elements[j][i]);
        } while (--np);
        M.elements[j] = els;
      }
    } while (--ni);
    return Matrix.create(inverse_elements);
  },

  inv: function() { return this.inverse(); },

  // Returns the result of rounding all the elements
  round: function() {
    return this.map(function(x) { return Math.round(x); });
  },

  // Returns a copy of the matrix with elements set to the given value if they
  // differ from it by less than Sylvester.precision
  snapTo: function(x) {
    return this.map(function(p) {
      return (Math.abs(p - x) <= Sylvester.precision) ? x : p;
    });
  },

  // Returns a string representation of the matrix
  inspect: function() {
    var matrix_rows = [];
    var n = this.elements.length, k = n, i;
    do { i = k - n;
      matrix_rows.push(Vector.create(this.elements[i]).inspect());
    } while (--n);
    return matrix_rows.join('\n');
  },

  // Set the matrix's elements from an array. If the argument passed
  // is a vector, the resulting matrix will be a single column.
  setElements: function(els) {
    var i, elements = els.elements || els;
    if (typeof(elements[0][0]) != 'undefined') {
      var ni = elements.length, ki = ni, nj, kj, j;
      this.elements = [];
      do { i = ki - ni;
        nj = elements[i].length; kj = nj;
        this.elements[i] = [];
        do { j = kj - nj;
          this.elements[i][j] = elements[i][j];
        } while (--nj);
      } while(--ni);
      return this;
    }
    var n = elements.length, k = n;
    this.elements = [];
    do { i = k - n;
      this.elements.push([elements[i]]);
    } while (--n);
    return this;
  }
};

// Constructor function
Matrix.create = function(elements) {
  var M = new Matrix();
  return M.setElements(elements);
};

// Identity matrix of size n
Matrix.I = function(n) {
  var els = [], k = n, i, nj, j;
  do { i = k - n;
    els[i] = []; nj = k;
    do { j = k - nj;
      els[i][j] = (i == j) ? 1 : 0;
    } while (--nj);
  } while (--n);
  return Matrix.create(els);
};

// Diagonal matrix - all off-diagonal elements are zero
Matrix.Diagonal = function(elements) {
  var n = elements.length, k = n, i;
  var M = Matrix.I(n);
  do { i = k - n;
    M.elements[i][i] = elements[i];
  } while (--n);
  return M;
};

// Rotation matrix about some axis. If no axis is
// supplied, assume we're after a 2D transform
Matrix.Rotation = function(theta, a) {
  if (!a) {
    return Matrix.create([
      [Math.cos(theta),  -Math.sin(theta)],
      [Math.sin(theta),   Math.cos(theta)]
    ]);
  }
  var axis = a.dup();
  if (axis.elements.length != 3) { return null; }
  var mod = axis.modulus();
  var x = axis.elements[0]/mod, y = axis.elements[1]/mod, z = axis.elements[2]/mod;
  var s = Math.sin(theta), c = Math.cos(theta), t = 1 - c;
  // Formula derived here: http://www.gamedev.net/reference/articles/article1199.asp
  // That proof rotates the co-ordinate system so theta
  // becomes -theta and sin becomes -sin here.
  return Matrix.create([
    [ t*x*x + c, t*x*y - s*z, t*x*z + s*y ],
    [ t*x*y + s*z, t*y*y + c, t*y*z - s*x ],
    [ t*x*z - s*y, t*y*z + s*x, t*z*z + c ]
  ]);
};

// Special case rotations
Matrix.RotationX = function(t) {
  var c = Math.cos(t), s = Math.sin(t);
  return Matrix.create([
    [  1,  0,  0 ],
    [  0,  c, -s ],
    [  0,  s,  c ]
  ]);
};
Matrix.RotationY = function(t) {
  var c = Math.cos(t), s = Math.sin(t);
  return Matrix.create([
    [  c,  0,  s ],
    [  0,  1,  0 ],
    [ -s,  0,  c ]
  ]);
};
Matrix.RotationZ = function(t) {
  var c = Math.cos(t), s = Math.sin(t);
  return Matrix.create([
    [  c, -s,  0 ],
    [  s,  c,  0 ],
    [  0,  0,  1 ]
  ]);
};

// Random matrix of n rows, m columns
Matrix.Random = function(n, m) {
  return Matrix.Zero(n, m).map(
    function() { return Math.random(); }
  );
};

// Matrix filled with zeros
Matrix.Zero = function(n, m) {
  var els = [], ni = n, i, nj, j;
  do { i = n - ni;
    els[i] = [];
    nj = m;
    do { j = m - nj;
      els[i][j] = 0;
    } while (--nj);
  } while (--ni);
  return Matrix.create(els);
};



function Line() {}
Line.prototype = {

  // Returns true if the argument occupies the same space as the line
  eql: function(line) {
    return (this.isParallelTo(line) && this.contains(line.anchor));
  },

  // Returns a copy of the line
  dup: function() {
    return Line.create(this.anchor, this.direction);
  },

  // Returns the result of translating the line by the given vector/array
  translate: function(vector) {
    var V = vector.elements || vector;
    return Line.create([
      this.anchor.elements[0] + V[0],
      this.anchor.elements[1] + V[1],
      this.anchor.elements[2] + (V[2] || 0)
    ], this.direction);
  },

  // Returns true if the line is parallel to the argument. Here, 'parallel to'
  // means that the argument's direction is either parallel or antiparallel to
  // the line's own direction. A line is parallel to a plane if the two do not
  // have a unique intersection.
  isParallelTo: function(obj) {
    if (obj.normal) { return obj.isParallelTo(this); }
    var theta = this.direction.angleFrom(obj.direction);
    return (Math.abs(theta) <= Sylvester.precision || Math.abs(theta - Math.PI) <= Sylvester.precision);
  },

  // Returns the line's perpendicular distance from the argument,
  // which can be a point, a line or a plane
  distanceFrom: function(obj) {
    if (obj.normal) { return obj.distanceFrom(this); }
    if (obj.direction) {
      // obj is a line
      if (this.isParallelTo(obj)) { return this.distanceFrom(obj.anchor); }
      var N = this.direction.cross(obj.direction).toUnitVector().elements;
      var A = this.anchor.elements, B = obj.anchor.elements;
      return Math.abs((A[0] - B[0]) * N[0] + (A[1] - B[1]) * N[1] + (A[2] - B[2]) * N[2]);
    } else {
      // obj is a point
      var P = obj.elements || obj;
      var A = this.anchor.elements, D = this.direction.elements;
      var PA1 = P[0] - A[0], PA2 = P[1] - A[1], PA3 = (P[2] || 0) - A[2];
      var modPA = Math.sqrt(PA1*PA1 + PA2*PA2 + PA3*PA3);
      if (modPA === 0) return 0;
      // Assumes direction vector is normalized
      var cosTheta = (PA1 * D[0] + PA2 * D[1] + PA3 * D[2]) / modPA;
      var sin2 = 1 - cosTheta*cosTheta;
      return Math.abs(modPA * Math.sqrt(sin2 < 0 ? 0 : sin2));
    }
  },

  // Returns true iff the argument is a point on the line
  contains: function(point) {
    var dist = this.distanceFrom(point);
    return (dist !== null && dist <= Sylvester.precision);
  },

  // Returns true iff the line lies in the given plane
  liesIn: function(plane) {
    return plane.contains(this);
  },

  // Returns true iff the line has a unique point of intersection with the argument
  intersects: function(obj) {
    if (obj.normal) { return obj.intersects(this); }
    return (!this.isParallelTo(obj) && this.distanceFrom(obj) <= Sylvester.precision);
  },

  // Returns the unique intersection point with the argument, if one exists
  intersectionWith: function(obj) {
    if (obj.normal) { return obj.intersectionWith(this); }
    if (!this.intersects(obj)) { return null; }
    var P = this.anchor.elements, X = this.direction.elements,
        Q = obj.anchor.elements, Y = obj.direction.elements;
    var X1 = X[0], X2 = X[1], X3 = X[2], Y1 = Y[0], Y2 = Y[1], Y3 = Y[2];
    var PsubQ1 = P[0] - Q[0], PsubQ2 = P[1] - Q[1], PsubQ3 = P[2] - Q[2];
    var XdotQsubP = - X1*PsubQ1 - X2*PsubQ2 - X3*PsubQ3;
    var YdotPsubQ = Y1*PsubQ1 + Y2*PsubQ2 + Y3*PsubQ3;
    var XdotX = X1*X1 + X2*X2 + X3*X3;
    var YdotY = Y1*Y1 + Y2*Y2 + Y3*Y3;
    var XdotY = X1*Y1 + X2*Y2 + X3*Y3;
    var k = (XdotQsubP * YdotY / XdotX + XdotY * YdotPsubQ) / (YdotY - XdotY * XdotY);
    return Vector.create([P[0] + k*X1, P[1] + k*X2, P[2] + k*X3]);
  },

  // Returns the point on the line that is closest to the given point or line
  pointClosestTo: function(obj) {
    if (obj.direction) {
      // obj is a line
      if (this.intersects(obj)) { return this.intersectionWith(obj); }
      if (this.isParallelTo(obj)) { return null; }
      var D = this.direction.elements, E = obj.direction.elements;
      var D1 = D[0], D2 = D[1], D3 = D[2], E1 = E[0], E2 = E[1], E3 = E[2];
      // Create plane containing obj and the shared normal and intersect this with it
      // Thank you: http://www.cgafaq.info/wiki/Line-line_distance
      var x = (D3 * E1 - D1 * E3), y = (D1 * E2 - D2 * E1), z = (D2 * E3 - D3 * E2);
      var N = Vector.create([x * E3 - y * E2, y * E1 - z * E3, z * E2 - x * E1]);
      var P = Plane.create(obj.anchor, N);
      return P.intersectionWith(this);
    } else {
      // obj is a point
      var P = obj.elements || obj;
      if (this.contains(P)) { return Vector.create(P); }
      var A = this.anchor.elements, D = this.direction.elements;
      var D1 = D[0], D2 = D[1], D3 = D[2], A1 = A[0], A2 = A[1], A3 = A[2];
      var x = D1 * (P[1]-A2) - D2 * (P[0]-A1), y = D2 * ((P[2] || 0) - A3) - D3 * (P[1]-A2),
          z = D3 * (P[0]-A1) - D1 * ((P[2] || 0) - A3);
      var V = Vector.create([D2 * x - D3 * z, D3 * y - D1 * x, D1 * z - D2 * y]);
      var k = this.distanceFrom(P) / V.modulus();
      return Vector.create([
        P[0] + V.elements[0] * k,
        P[1] + V.elements[1] * k,
        (P[2] || 0) + V.elements[2] * k
      ]);
    }
  },

  // Returns a copy of the line rotated by t radians about the given line. Works by
  // finding the argument's closest point to this line's anchor point (call this C) and
  // rotating the anchor about C. Also rotates the line's direction about the argument's.
  // Be careful with this - the rotation axis' direction affects the outcome!
  rotate: function(t, line) {
    // If we're working in 2D
    if (typeof(line.direction) == 'undefined') { line = Line.create(line.to3D(), Vector.k); }
    var R = Matrix.Rotation(t, line.direction).elements;
    var C = line.pointClosestTo(this.anchor).elements;
    var A = this.anchor.elements, D = this.direction.elements;
    var C1 = C[0], C2 = C[1], C3 = C[2], A1 = A[0], A2 = A[1], A3 = A[2];
    var x = A1 - C1, y = A2 - C2, z = A3 - C3;
    return Line.create([
      C1 + R[0][0] * x + R[0][1] * y + R[0][2] * z,
      C2 + R[1][0] * x + R[1][1] * y + R[1][2] * z,
      C3 + R[2][0] * x + R[2][1] * y + R[2][2] * z
    ], [
      R[0][0] * D[0] + R[0][1] * D[1] + R[0][2] * D[2],
      R[1][0] * D[0] + R[1][1] * D[1] + R[1][2] * D[2],
      R[2][0] * D[0] + R[2][1] * D[1] + R[2][2] * D[2]
    ]);
  },

  // Returns the line's reflection in the given point or line
  reflectionIn: function(obj) {
    if (obj.normal) {
      // obj is a plane
      var A = this.anchor.elements, D = this.direction.elements;
      var A1 = A[0], A2 = A[1], A3 = A[2], D1 = D[0], D2 = D[1], D3 = D[2];
      var newA = this.anchor.reflectionIn(obj).elements;
      // Add the line's direction vector to its anchor, then mirror that in the plane
      var AD1 = A1 + D1, AD2 = A2 + D2, AD3 = A3 + D3;
      var Q = obj.pointClosestTo([AD1, AD2, AD3]).elements;
      var newD = [Q[0] + (Q[0] - AD1) - newA[0], Q[1] + (Q[1] - AD2) - newA[1], Q[2] + (Q[2] - AD3) - newA[2]];
      return Line.create(newA, newD);
    } else if (obj.direction) {
      // obj is a line - reflection obtained by rotating PI radians about obj
      return this.rotate(Math.PI, obj);
    } else {
      // obj is a point - just reflect the line's anchor in it
      var P = obj.elements || obj;
      return Line.create(this.anchor.reflectionIn([P[0], P[1], (P[2] || 0)]), this.direction);
    }
  },

  // Set the line's anchor point and direction.
  setVectors: function(anchor, direction) {
    // Need to do this so that line's properties are not
    // references to the arguments passed in
    anchor = Vector.create(anchor);
    direction = Vector.create(direction);
    if (anchor.elements.length == 2) {anchor.elements.push(0); }
    if (direction.elements.length == 2) { direction.elements.push(0); }
    if (anchor.elements.length > 3 || direction.elements.length > 3) { return null; }
    var mod = direction.modulus();
    if (mod === 0) { return null; }
    this.anchor = anchor;
    this.direction = Vector.create([
      direction.elements[0] / mod,
      direction.elements[1] / mod,
      direction.elements[2] / mod
    ]);
    return this;
  }
};

  
// Constructor function
Line.create = function(anchor, direction) {
  var L = new Line();
  return L.setVectors(anchor, direction);
};

// Axes
Line.X = Line.create(Vector.Zero(3), Vector.i);
Line.Y = Line.create(Vector.Zero(3), Vector.j);
Line.Z = Line.create(Vector.Zero(3), Vector.k);



function Plane() {}
Plane.prototype = {

  // Returns true iff the plane occupies the same space as the argument
  eql: function(plane) {
    return (this.contains(plane.anchor) && this.isParallelTo(plane));
  },

  // Returns a copy of the plane
  dup: function() {
    return Plane.create(this.anchor, this.normal);
  },

  // Returns the result of translating the plane by the given vector
  translate: function(vector) {
    var V = vector.elements || vector;
    return Plane.create([
      this.anchor.elements[0] + V[0],
      this.anchor.elements[1] + V[1],
      this.anchor.elements[2] + (V[2] || 0)
    ], this.normal);
  },

  // Returns true iff the plane is parallel to the argument. Will return true
  // if the planes are equal, or if you give a line and it lies in the plane.
  isParallelTo: function(obj) {
    var theta;
    if (obj.normal) {
      // obj is a plane
      theta = this.normal.angleFrom(obj.normal);
      return (Math.abs(theta) <= Sylvester.precision || Math.abs(Math.PI - theta) <= Sylvester.precision);
    } else if (obj.direction) {
      // obj is a line
      return this.normal.isPerpendicularTo(obj.direction);
    }
    return null;
  },
  
  // Returns true iff the receiver is perpendicular to the argument
  isPerpendicularTo: function(plane) {
    var theta = this.normal.angleFrom(plane.normal);
    return (Math.abs(Math.PI/2 - theta) <= Sylvester.precision);
  },

  // Returns the plane's distance from the given object (point, line or plane)
  distanceFrom: function(obj) {
    if (this.intersects(obj) || this.contains(obj)) { return 0; }
    if (obj.anchor) {
      // obj is a plane or line
      var A = this.anchor.elements, B = obj.anchor.elements, N = this.normal.elements;
      return Math.abs((A[0] - B[0]) * N[0] + (A[1] - B[1]) * N[1] + (A[2] - B[2]) * N[2]);
    } else {
      // obj is a point
      var P = obj.elements || obj;
      var A = this.anchor.elements, N = this.normal.elements;
      return Math.abs((A[0] - P[0]) * N[0] + (A[1] - P[1]) * N[1] + (A[2] - (P[2] || 0)) * N[2]);
    }
  },

  // Returns true iff the plane contains the given point or line
  contains: function(obj) {
    if (obj.normal) { return null; }
    if (obj.direction) {
      return (this.contains(obj.anchor) && this.contains(obj.anchor.add(obj.direction)));
    } else {
      var P = obj.elements || obj;
      var A = this.anchor.elements, N = this.normal.elements;
      var diff = Math.abs(N[0]*(A[0] - P[0]) + N[1]*(A[1] - P[1]) + N[2]*(A[2] - (P[2] || 0)));
      return (diff <= Sylvester.precision);
    }
  },

  // Returns true iff the plane has a unique point/line of intersection with the argument
  intersects: function(obj) {
    if (typeof(obj.direction) == 'undefined' && typeof(obj.normal) == 'undefined') { return null; }
    return !this.isParallelTo(obj);
  },

  // Returns the unique intersection with the argument, if one exists. The result
  // will be a vector if a line is supplied, and a line if a plane is supplied.
  intersectionWith: function(obj) {
    if (!this.intersects(obj)) { return null; }
    if (obj.direction) {
      // obj is a line
      var A = obj.anchor.elements, D = obj.direction.elements,
          P = this.anchor.elements, N = this.normal.elements;
      var multiplier = (N[0]*(P[0]-A[0]) + N[1]*(P[1]-A[1]) + N[2]*(P[2]-A[2])) / (N[0]*D[0] + N[1]*D[1] + N[2]*D[2]);
      return Vector.create([A[0] + D[0]*multiplier, A[1] + D[1]*multiplier, A[2] + D[2]*multiplier]);
    } else if (obj.normal) {
      // obj is a plane
      var direction = this.normal.cross(obj.normal).toUnitVector();
      // To find an anchor point, we find one co-ordinate that has a value
      // of zero somewhere on the intersection, and remember which one we picked
      var N = this.normal.elements, A = this.anchor.elements,
          O = obj.normal.elements, B = obj.anchor.elements;
      var solver = Matrix.Zero(2,2), i = 0;
      while (solver.isSingular()) {
        i++;
        solver = Matrix.create([
          [ N[i%3], N[(i+1)%3] ],
          [ O[i%3], O[(i+1)%3]  ]
        ]);
      }
      // Then we solve the simultaneous equations in the remaining dimensions
      var inverse = solver.inverse().elements;
      var x = N[0]*A[0] + N[1]*A[1] + N[2]*A[2];
      var y = O[0]*B[0] + O[1]*B[1] + O[2]*B[2];
      var intersection = [
        inverse[0][0] * x + inverse[0][1] * y,
        inverse[1][0] * x + inverse[1][1] * y
      ];
      var anchor = [];
      for (var j = 1; j <= 3; j++) {
        // This formula picks the right element from intersection by
        // cycling depending on which element we set to zero above
        anchor.push((i == j) ? 0 : intersection[(j + (5 - i)%3)%3]);
      }
      return Line.create(anchor, direction);
    }
  },

  // Returns the point in the plane closest to the given point
  pointClosestTo: function(point) {
    var P = point.elements || point;
    var A = this.anchor.elements, N = this.normal.elements;
    var dot = (A[0] - P[0]) * N[0] + (A[1] - P[1]) * N[1] + (A[2] - (P[2] || 0)) * N[2];
    return Vector.create([P[0] + N[0] * dot, P[1] + N[1] * dot, (P[2] || 0) + N[2] * dot]);
  },

  // Returns a copy of the plane, rotated by t radians about the given line
  // See notes on Line#rotate.
  rotate: function(t, line) {
    var R = Matrix.Rotation(t, line.direction).elements;
    var C = line.pointClosestTo(this.anchor).elements;
    var A = this.anchor.elements, N = this.normal.elements;
    var C1 = C[0], C2 = C[1], C3 = C[2], A1 = A[0], A2 = A[1], A3 = A[2];
    var x = A1 - C1, y = A2 - C2, z = A3 - C3;
    return Plane.create([
      C1 + R[0][0] * x + R[0][1] * y + R[0][2] * z,
      C2 + R[1][0] * x + R[1][1] * y + R[1][2] * z,
      C3 + R[2][0] * x + R[2][1] * y + R[2][2] * z
    ], [
      R[0][0] * N[0] + R[0][1] * N[1] + R[0][2] * N[2],
      R[1][0] * N[0] + R[1][1] * N[1] + R[1][2] * N[2],
      R[2][0] * N[0] + R[2][1] * N[1] + R[2][2] * N[2]
    ]);
  },

  // Returns the reflection of the plane in the given point, line or plane.
  reflectionIn: function(obj) {
    if (obj.normal) {
      // obj is a plane
      var A = this.anchor.elements, N = this.normal.elements;
      var A1 = A[0], A2 = A[1], A3 = A[2], N1 = N[0], N2 = N[1], N3 = N[2];
      var newA = this.anchor.reflectionIn(obj).elements;
      // Add the plane's normal to its anchor, then mirror that in the other plane
      var AN1 = A1 + N1, AN2 = A2 + N2, AN3 = A3 + N3;
      var Q = obj.pointClosestTo([AN1, AN2, AN3]).elements;
      var newN = [Q[0] + (Q[0] - AN1) - newA[0], Q[1] + (Q[1] - AN2) - newA[1], Q[2] + (Q[2] - AN3) - newA[2]];
      return Plane.create(newA, newN);
    } else if (obj.direction) {
      // obj is a line
      return this.rotate(Math.PI, obj);
    } else {
      // obj is a point
      var P = obj.elements || obj;
      return Plane.create(this.anchor.reflectionIn([P[0], P[1], (P[2] || 0)]), this.normal);
    }
  },

  // Sets the anchor point and normal to the plane. If three arguments are specified,
  // the normal is calculated by assuming the three points should lie in the same plane.
  // If only two are sepcified, the second is taken to be the normal. Normal vector is
  // normalised before storage.
  setVectors: function(anchor, v1, v2) {
    anchor = Vector.create(anchor);
    anchor = anchor.to3D(); if (anchor === null) { return null; }
    v1 = Vector.create(v1);
    v1 = v1.to3D(); if (v1 === null) { return null; }
    if (typeof(v2) == 'undefined') {
      v2 = null;
    } else {
      v2 = Vector.create(v2);
      v2 = v2.to3D(); if (v2 === null) { return null; }
    }
    var A1 = anchor.elements[0], A2 = anchor.elements[1], A3 = anchor.elements[2];
    var v11 = v1.elements[0], v12 = v1.elements[1], v13 = v1.elements[2];
    var normal, mod;
    if (v2 !== null) {
      var v21 = v2.elements[0], v22 = v2.elements[1], v23 = v2.elements[2];
      normal = Vector.create([
        (v12 - A2) * (v23 - A3) - (v13 - A3) * (v22 - A2),
        (v13 - A3) * (v21 - A1) - (v11 - A1) * (v23 - A3),
        (v11 - A1) * (v22 - A2) - (v12 - A2) * (v21 - A1)
      ]);
      mod = normal.modulus();
      if (mod === 0) { return null; }
      normal = Vector.create([normal.elements[0] / mod, normal.elements[1] / mod, normal.elements[2] / mod]);
    } else {
      mod = Math.sqrt(v11*v11 + v12*v12 + v13*v13);
      if (mod === 0) { return null; }
      normal = Vector.create([v1.elements[0] / mod, v1.elements[1] / mod, v1.elements[2] / mod]);
    }
    this.anchor = anchor;
    this.normal = normal;
    return this;
  }
};

// Constructor function
Plane.create = function(anchor, v1, v2) {
  var P = new Plane();
  return P.setVectors(anchor, v1, v2);
};

// X-Y-Z planes
Plane.XY = Plane.create(Vector.Zero(3), Vector.k);
Plane.YZ = Plane.create(Vector.Zero(3), Vector.i);
Plane.ZX = Plane.create(Vector.Zero(3), Vector.j);
Plane.YX = Plane.XY; Plane.ZY = Plane.YZ; Plane.XZ = Plane.ZX;

// Utility functions
var $V = Vector.create;
var $M = Matrix.create;
var $L = Line.create;
var $P = Plane.create;

/*
 * A fast javascript implementation of simplex noise by Jonas Wagner
 *
 * Based on a speed-improved simplex noise algorithm for 2D, 3D and 4D in Java.
 * Which is based on example code by Stefan Gustavson (stegu@itn.liu.se).
 * With Optimisations by Peter Eastman (peastman@drizzle.stanford.edu).
 * Better rank ordering method by Stefan Gustavson in 2012.
 *
 *
 * Copyright (C) 2012 Jonas Wagner
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */
(function () {

var F2 = 0.5 * (Math.sqrt(3.0) - 1.0),
    G2 = (3.0 - Math.sqrt(3.0)) / 6.0,
    F3 = 1.0 / 3.0,
    G3 = 1.0 / 6.0,
    F4 = (Math.sqrt(5.0) - 1.0) / 4.0,
    G4 = (5.0 - Math.sqrt(5.0)) / 20.0;


function SimplexNoise(random) {
    if (!random) random = Math.random;
    this.p = new Uint8Array(256);
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (var i = 0; i < 256; i++) {
        this.p[i] = random() * 256;
    }
    for (i = 0; i < 512; i++) {
        this.perm[i] = this.p[i & 255];
        this.permMod12[i] = this.perm[i] % 12;
    }

}
SimplexNoise.prototype = {
    grad1: function(hash, x) {
        var h = hash & 15;
        var grad = 1 + (h & 7); // Gradient value 1.0, 2.0, ..., 8.0
        if (h&8) grad = -grad;  // Set a random sign for the gradient
        return ( grad * x );    // Multiply the gradient with the distance
    },
    grad3: new Float32Array([1, 1, 0,
                            - 1, 1, 0,
                            1, - 1, 0,

                            - 1, - 1, 0,
                            1, 0, 1,
                            - 1, 0, 1,

                            1, 0, - 1,
                            - 1, 0, - 1,
                            0, 1, 1,

                            0, - 1, 1,
                            0, 1, - 1,
                            0, - 1, - 1]),
    grad4: new Float32Array([0, 1, 1, 1, 0, 1, 1, - 1, 0, 1, - 1, 1, 0, 1, - 1, - 1,
                            0, - 1, 1, 1, 0, - 1, 1, - 1, 0, - 1, - 1, 1, 0, - 1, - 1, - 1,
                            1, 0, 1, 1, 1, 0, 1, - 1, 1, 0, - 1, 1, 1, 0, - 1, - 1,
                            - 1, 0, 1, 1, - 1, 0, 1, - 1, - 1, 0, - 1, 1, - 1, 0, - 1, - 1,
                            1, 1, 0, 1, 1, 1, 0, - 1, 1, - 1, 0, 1, 1, - 1, 0, - 1,
                            - 1, 1, 0, 1, - 1, 1, 0, - 1, - 1, - 1, 0, 1, - 1, - 1, 0, - 1,
                            1, 1, 1, 0, 1, 1, - 1, 0, 1, - 1, 1, 0, 1, - 1, - 1, 0,
                            - 1, 1, 1, 0, - 1, 1, - 1, 0, - 1, - 1, 1, 0, - 1, - 1, - 1, 0]),
    noise1D: function (x) {
        var i0 = Math.floor(x);
        var i1 = i0 + 1;
        var x0 = x - i0;
        var x1 = x0 - 1;

        var n0, n1;

        var t0 = 1 - x0*x0;
        //  if(t0 < 0.0f) t0 = 0.0f;
        t0 *= t0;
        n0 = t0 * t0 * this.grad1(this.perm[i0 & 0xff], x0);

        var t1 = 1 - x1*x1;
        //  if(t1 < 0.0f) t1 = 0.0f;
        t1 *= t1;
        n1 = t1 * t1 * this.grad1(this.perm[i1 & 0xff], x1);
        // The maximum value of this noise is 8*(3/4)^4 = 2.53125
        // A factor of 0.395 will scale to fit exactly within [-1,1]
        return 0.395 * (n0 + n1);
    },
    noise2D: function (xin, yin) {
        var permMod12 = this.permMod12,
            perm = this.perm,
            grad3 = this.grad3;
        var n0=0, n1=0, n2=0; // Noise contributions from the three corners
        // Skew the input space to determine which simplex cell we're in
        var s = (xin + yin) * F2; // Hairy factor for 2D
        var i = Math.floor(xin + s);
        var j = Math.floor(yin + s);
        var t = (i + j) * G2;
        var X0 = i - t; // Unskew the cell origin back to (x,y) space
        var Y0 = j - t;
        var x0 = xin - X0; // The x,y distances from the cell origin
        var y0 = yin - Y0;
        // For the 2D case, the simplex shape is an equilateral triangle.
        // Determine which simplex we are in.
        var i1, j1; // Offsets for second (middle) corner of simplex in (i,j) coords
        if (x0 > y0) {
            i1 = 1;
            j1 = 0;
        } // lower triangle, XY order: (0,0)->(1,0)->(1,1)
        else {
            i1 = 0;
            j1 = 1;
        } // upper triangle, YX order: (0,0)->(0,1)->(1,1)
        // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
        // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
        // c = (3-sqrt(3))/6
        var x1 = x0 - i1 + G2; // Offsets for middle corner in (x,y) unskewed coords
        var y1 = y0 - j1 + G2;
        var x2 = x0 - 1.0 + 2.0 * G2; // Offsets for last corner in (x,y) unskewed coords
        var y2 = y0 - 1.0 + 2.0 * G2;
        // Work out the hashed gradient indices of the three simplex corners
        var ii = i & 255;
        var jj = j & 255;
        // Calculate the contribution from the three corners
        var t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 >= 0) {
            var gi0 = permMod12[ii + perm[jj]] * 3;
            t0 *= t0;
            n0 = t0 * t0 * (grad3[gi0] * x0 + grad3[gi0 + 1] * y0); // (x,y) of grad3 used for 2D gradient
        }
        var t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 >= 0) {
            var gi1 = permMod12[ii + i1 + perm[jj + j1]] * 3;
            t1 *= t1;
            n1 = t1 * t1 * (grad3[gi1] * x1 + grad3[gi1 + 1] * y1);
        }
        var t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 >= 0) {
            var gi2 = permMod12[ii + 1 + perm[jj + 1]] * 3;
            t2 *= t2;
            n2 = t2 * t2 * (grad3[gi2] * x2 + grad3[gi2 + 1] * y2);
        }
        // Add contributions from each corner to get the final noise value.
        // The result is scaled to return values in the interval [-1,1].
        return 70.0 * (n0 + n1 + n2);
    },
    // 3D simplex noise
    noise3D: function (xin, yin, zin) {
        var permMod12 = this.permMod12,
            perm = this.perm,
            grad3 = this.grad3;
        var n0, n1, n2, n3; // Noise contributions from the four corners
        // Skew the input space to determine which simplex cell we're in
        var s = (xin + yin + zin) * F3; // Very nice and simple skew factor for 3D
        var i = Math.floor(xin + s);
        var j = Math.floor(yin + s);
        var k = Math.floor(zin + s);
        var t = (i + j + k) * G3;
        var X0 = i - t; // Unskew the cell origin back to (x,y,z) space
        var Y0 = j - t;
        var Z0 = k - t;
        var x0 = xin - X0; // The x,y,z distances from the cell origin
        var y0 = yin - Y0;
        var z0 = zin - Z0;
        // For the 3D case, the simplex shape is a slightly irregular tetrahedron.
        // Determine which simplex we are in.
        var i1, j1, k1; // Offsets for second corner of simplex in (i,j,k) coords
        var i2, j2, k2; // Offsets for third corner of simplex in (i,j,k) coords
        if (x0 >= y0) {
            if (y0 >= z0) {
                i1 = 1;
                j1 = 0;
                k1 = 0;
                i2 = 1;
                j2 = 1;
                k2 = 0;
            } // X Y Z order
            else if (x0 >= z0) {
                i1 = 1;
                j1 = 0;
                k1 = 0;
                i2 = 1;
                j2 = 0;
                k2 = 1;
            } // X Z Y order
            else {
                i1 = 0;
                j1 = 0;
                k1 = 1;
                i2 = 1;
                j2 = 0;
                k2 = 1;
            } // Z X Y order
        }
        else { // x0<y0
            if (y0 < z0) {
                i1 = 0;
                j1 = 0;
                k1 = 1;
                i2 = 0;
                j2 = 1;
                k2 = 1;
            } // Z Y X order
            else if (x0 < z0) {
                i1 = 0;
                j1 = 1;
                k1 = 0;
                i2 = 0;
                j2 = 1;
                k2 = 1;
            } // Y Z X order
            else {
                i1 = 0;
                j1 = 1;
                k1 = 0;
                i2 = 1;
                j2 = 1;
                k2 = 0;
            } // Y X Z order
        }
        // A step of (1,0,0) in (i,j,k) means a step of (1-c,-c,-c) in (x,y,z),
        // a step of (0,1,0) in (i,j,k) means a step of (-c,1-c,-c) in (x,y,z), and
        // a step of (0,0,1) in (i,j,k) means a step of (-c,-c,1-c) in (x,y,z), where
        // c = 1/6.
        var x1 = x0 - i1 + G3; // Offsets for second corner in (x,y,z) coords
        var y1 = y0 - j1 + G3;
        var z1 = z0 - k1 + G3;
        var x2 = x0 - i2 + 2.0 * G3; // Offsets for third corner in (x,y,z) coords
        var y2 = y0 - j2 + 2.0 * G3;
        var z2 = z0 - k2 + 2.0 * G3;
        var x3 = x0 - 1.0 + 3.0 * G3; // Offsets for last corner in (x,y,z) coords
        var y3 = y0 - 1.0 + 3.0 * G3;
        var z3 = z0 - 1.0 + 3.0 * G3;
        // Work out the hashed gradient indices of the four simplex corners
        var ii = i & 255;
        var jj = j & 255;
        var kk = k & 255;
        // Calculate the contribution from the four corners
        var t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
        if (t0 < 0) n0 = 0.0;
        else {
            var gi0 = permMod12[ii + perm[jj + perm[kk]]] * 3;
            t0 *= t0;
            n0 = t0 * t0 * (grad3[gi0] * x0 + grad3[gi0 + 1] * y0 + grad3[gi0 + 2] * z0);
        }
        var t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
        if (t1 < 0) n1 = 0.0;
        else {
            var gi1 = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3;
            t1 *= t1;
            n1 = t1 * t1 * (grad3[gi1] * x1 + grad3[gi1 + 1] * y1 + grad3[gi1 + 2] * z1);
        }
        var t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
        if (t2 < 0) n2 = 0.0;
        else {
            var gi2 = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3;
            t2 *= t2;
            n2 = t2 * t2 * (grad3[gi2] * x2 + grad3[gi2 + 1] * y2 + grad3[gi2 + 2] * z2);
        }
        var t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
        if (t3 < 0) n3 = 0.0;
        else {
            var gi3 = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3;
            t3 *= t3;
            n3 = t3 * t3 * (grad3[gi3] * x3 + grad3[gi3 + 1] * y3 + grad3[gi3 + 2] * z3);
        }
        // Add contributions from each corner to get the final noise value.
        // The result is scaled to stay just inside [-1,1]
        return 32.0 * (n0 + n1 + n2 + n3);
    },
    // 4D simplex noise, better simplex rank ordering method 2012-03-09
    noise4D: function (x, y, z, w) {
        var permMod12 = this.permMod12,
            perm = this.perm,
            grad4 = this.grad4;

        var n0, n1, n2, n3, n4; // Noise contributions from the five corners
        // Skew the (x,y,z,w) space to determine which cell of 24 simplices we're in
        var s = (x + y + z + w) * F4; // Factor for 4D skewing
        var i = Math.floor(x + s);
        var j = Math.floor(y + s);
        var k = Math.floor(z + s);
        var l = Math.floor(w + s);
        var t = (i + j + k + l) * G4; // Factor for 4D unskewing
        var X0 = i - t; // Unskew the cell origin back to (x,y,z,w) space
        var Y0 = j - t;
        var Z0 = k - t;
        var W0 = l - t;
        var x0 = x - X0; // The x,y,z,w distances from the cell origin
        var y0 = y - Y0;
        var z0 = z - Z0;
        var w0 = w - W0;
        // For the 4D case, the simplex is a 4D shape I won't even try to describe.
        // To find out which of the 24 possible simplices we're in, we need to
        // determine the magnitude ordering of x0, y0, z0 and w0.
        // Six pair-wise comparisons are performed between each possible pair
        // of the four coordinates, and the results are used to rank the numbers.
        var rankx = 0;
        var ranky = 0;
        var rankz = 0;
        var rankw = 0;
        if (x0 > y0) rankx++;
        else ranky++;
        if (x0 > z0) rankx++;
        else rankz++;
        if (x0 > w0) rankx++;
        else rankw++;
        if (y0 > z0) ranky++;
        else rankz++;
        if (y0 > w0) ranky++;
        else rankw++;
        if (z0 > w0) rankz++;
        else rankw++;
        var i1, j1, k1, l1; // The integer offsets for the second simplex corner
        var i2, j2, k2, l2; // The integer offsets for the third simplex corner
        var i3, j3, k3, l3; // The integer offsets for the fourth simplex corner
        // simplex[c] is a 4-vector with the numbers 0, 1, 2 and 3 in some order.
        // Many values of c will never occur, since e.g. x>y>z>w makes x<z, y<w and x<w
        // impossible. Only the 24 indices which have non-zero entries make any sense.
        // We use a thresholding to set the coordinates in turn from the largest magnitude.
        // Rank 3 denotes the largest coordinate.
        i1 = rankx >= 3 ? 1 : 0;
        j1 = ranky >= 3 ? 1 : 0;
        k1 = rankz >= 3 ? 1 : 0;
        l1 = rankw >= 3 ? 1 : 0;
        // Rank 2 denotes the second largest coordinate.
        i2 = rankx >= 2 ? 1 : 0;
        j2 = ranky >= 2 ? 1 : 0;
        k2 = rankz >= 2 ? 1 : 0;
        l2 = rankw >= 2 ? 1 : 0;
        // Rank 1 denotes the second smallest coordinate.
        i3 = rankx >= 1 ? 1 : 0;
        j3 = ranky >= 1 ? 1 : 0;
        k3 = rankz >= 1 ? 1 : 0;
        l3 = rankw >= 1 ? 1 : 0;
        // The fifth corner has all coordinate offsets = 1, so no need to compute that.
        var x1 = x0 - i1 + G4; // Offsets for second corner in (x,y,z,w) coords
        var y1 = y0 - j1 + G4;
        var z1 = z0 - k1 + G4;
        var w1 = w0 - l1 + G4;
        var x2 = x0 - i2 + 2.0 * G4; // Offsets for third corner in (x,y,z,w) coords
        var y2 = y0 - j2 + 2.0 * G4;
        var z2 = z0 - k2 + 2.0 * G4;
        var w2 = w0 - l2 + 2.0 * G4;
        var x3 = x0 - i3 + 3.0 * G4; // Offsets for fourth corner in (x,y,z,w) coords
        var y3 = y0 - j3 + 3.0 * G4;
        var z3 = z0 - k3 + 3.0 * G4;
        var w3 = w0 - l3 + 3.0 * G4;
        var x4 = x0 - 1.0 + 4.0 * G4; // Offsets for last corner in (x,y,z,w) coords
        var y4 = y0 - 1.0 + 4.0 * G4;
        var z4 = z0 - 1.0 + 4.0 * G4;
        var w4 = w0 - 1.0 + 4.0 * G4;
        // Work out the hashed gradient indices of the five simplex corners
        var ii = i & 255;
        var jj = j & 255;
        var kk = k & 255;
        var ll = l & 255;
        // Calculate the contribution from the five corners
        var t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0 - w0 * w0;
        if (t0 < 0) n0 = 0.0;
        else {
            var gi0 = (perm[ii + perm[jj + perm[kk + perm[ll]]]] % 32) * 4;
            t0 *= t0;
            n0 = t0 * t0 * (grad4[gi0] * x0 + grad4[gi0 + 1] * y0 + grad4[gi0 + 2] * z0 + grad4[gi0 + 3] * w0);
        }
        var t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1 - w1 * w1;
        if (t1 < 0) n1 = 0.0;
        else {
            var gi1 = (perm[ii + i1 + perm[jj + j1 + perm[kk + k1 + perm[ll + l1]]]] % 32) * 4;
            t1 *= t1;
            n1 = t1 * t1 * (grad4[gi1] * x1 + grad4[gi1 + 1] * y1 + grad4[gi1 + 2] * z1 + grad4[gi1 + 3] * w1);
        }
        var t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2 - w2 * w2;
        if (t2 < 0) n2 = 0.0;
        else {
            var gi2 = (perm[ii + i2 + perm[jj + j2 + perm[kk + k2 + perm[ll + l2]]]] % 32) * 4;
            t2 *= t2;
            n2 = t2 * t2 * (grad4[gi2] * x2 + grad4[gi2 + 1] * y2 + grad4[gi2 + 2] * z2 + grad4[gi2 + 3] * w2);
        }
        var t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3 - w3 * w3;
        if (t3 < 0) n3 = 0.0;
        else {
            var gi3 = (perm[ii + i3 + perm[jj + j3 + perm[kk + k3 + perm[ll + l3]]]] % 32) * 4;
            t3 *= t3;
            n3 = t3 * t3 * (grad4[gi3] * x3 + grad4[gi3 + 1] * y3 + grad4[gi3 + 2] * z3 + grad4[gi3 + 3] * w3);
        }
        var t4 = 0.6 - x4 * x4 - y4 * y4 - z4 * z4 - w4 * w4;
        if (t4 < 0) n4 = 0.0;
        else {
            var gi4 = (perm[ii + 1 + perm[jj + 1 + perm[kk + 1 + perm[ll + 1]]]] % 32) * 4;
            t4 *= t4;
            n4 = t4 * t4 * (grad4[gi4] * x4 + grad4[gi4 + 1] * y4 + grad4[gi4 + 2] * z4 + grad4[gi4 + 3] * w4);
        }
        // Sum up and scale the result to cover the range [-1,1]
        return 27.0 * (n0 + n1 + n2 + n3 + n4);
    }


};

// amd
if (typeof define !== 'undefined' && define.amd) define(function(){return SimplexNoise;});
//common js
if (typeof exports !== 'undefined') exports.SimplexNoise = SimplexNoise;
// browser
else if (typeof navigator !== 'undefined') this.SimplexNoise = SimplexNoise;
// nodejs
if (typeof module !== 'undefined') {
    module.exports = SimplexNoise;
}

}).call(this);

// Copyright 2009 The Closure Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Defines a Long class for representing a 64-bit two's-complement
 * integer value, which faithfully simulates the behavior of a Java "long". This
 * implementation is derived from LongLib in GWT.
 *
 */

 // This file was obtained from Google's Closure library.
 // It was modified to work without the entire library.
 // The only change was to replace `goog.provide('goog.math.Long');`
 // with the below code.

window.goog = {
  math: {}
};

/**
 * Constructs a 64-bit two's-complement integer, given its low and high 32-bit
 * values as *signed* integers.  See the from* functions below for more
 * convenient ways of constructing Longs.
 *
 * The internal representation of a long is the two given signed, 32-bit values.
 * We use 32-bit pieces because these are the size of integers on which
 * Javascript performs bit-operations.  For operations like addition and
 * multiplication, we split each number into 16-bit pieces, which can easily be
 * multiplied within Javascript's floating-point representation without overflow
 * or change in sign.
 *
 * In the algorithms below, we frequently reduce the negative case to the
 * positive case by negating the input(s) and then post-processing the result.
 * Note that we must ALWAYS check specially whether those values are MIN_VALUE
 * (-2^63) because -MIN_VALUE == MIN_VALUE (since 2^63 cannot be represented as
 * a positive number, it overflows back into a negative).  Not handling this
 * case would often result in infinite recursion.
 *
 * @param {number} low  The low (signed) 32 bits of the long.
 * @param {number} high  The high (signed) 32 bits of the long.
 * @constructor
 * @final
 */
goog.math.Long = function(low, high) {
  /**
   * @type {number}
   * @private
   */
  this.low_ = low | 0;  // force into 32 signed bits.

  /**
   * @type {number}
   * @private
   */
  this.high_ = high | 0;  // force into 32 signed bits.
};


// NOTE: Common constant values ZERO, ONE, NEG_ONE, etc. are defined below the
// from* methods on which they depend.


/**
 * A cache of the Long representations of small integer values.
 * @type {!Object}
 * @private
 */
goog.math.Long.IntCache_ = {};


/**
 * Returns a Long representing the given (32-bit) integer value.
 * @param {number} value The 32-bit integer in question.
 * @return {!goog.math.Long} The corresponding Long value.
 */
goog.math.Long.fromInt = function(value) {
  if (-128 <= value && value < 128) {
    var cachedObj = goog.math.Long.IntCache_[value];
    if (cachedObj) {
      return cachedObj;
    }
  }

  var obj = new goog.math.Long(value | 0, value < 0 ? -1 : 0);
  if (-128 <= value && value < 128) {
    goog.math.Long.IntCache_[value] = obj;
  }
  return obj;
};


/**
 * Returns a Long representing the given value, provided that it is a finite
 * number.  Otherwise, zero is returned.
 * @param {number} value The number in question.
 * @return {!goog.math.Long} The corresponding Long value.
 */
goog.math.Long.fromNumber = function(value) {
  if (isNaN(value) || !isFinite(value)) {
    return goog.math.Long.ZERO;
  } else if (value <= -goog.math.Long.TWO_PWR_63_DBL_) {
    return goog.math.Long.MIN_VALUE;
  } else if (value + 1 >= goog.math.Long.TWO_PWR_63_DBL_) {
    return goog.math.Long.MAX_VALUE;
  } else if (value < 0) {
    return goog.math.Long.fromNumber(-value).negate();
  } else {
    return new goog.math.Long(
        (value % goog.math.Long.TWO_PWR_32_DBL_) | 0,
        (value / goog.math.Long.TWO_PWR_32_DBL_) | 0);
  }
};


/**
 * Returns a Long representing the 64-bit integer that comes by concatenating
 * the given high and low bits.  Each is assumed to use 32 bits.
 * @param {number} lowBits The low 32-bits.
 * @param {number} highBits The high 32-bits.
 * @return {!goog.math.Long} The corresponding Long value.
 */
goog.math.Long.fromBits = function(lowBits, highBits) {
  return new goog.math.Long(lowBits, highBits);
};


/**
 * Returns a Long representation of the given string, written using the given
 * radix.
 * @param {string} str The textual representation of the Long.
 * @param {number=} opt_radix The radix in which the text is written.
 * @return {!goog.math.Long} The corresponding Long value.
 */
goog.math.Long.fromString = function(str, opt_radix) {
  if (str.length == 0) {
    throw Error('number format error: empty string');
  }

  var radix = opt_radix || 10;
  if (radix < 2 || 36 < radix) {
    throw Error('radix out of range: ' + radix);
  }

  if (str.charAt(0) == '-') {
    return goog.math.Long.fromString(str.substring(1), radix).negate();
  } else if (str.indexOf('-') >= 0) {
    throw Error('number format error: interior "-" character: ' + str);
  }

  // Do several (8) digits each time through the loop, so as to
  // minimize the calls to the very expensive emulated div.
  var radixToPower = goog.math.Long.fromNumber(Math.pow(radix, 8));

  var result = goog.math.Long.ZERO;
  for (var i = 0; i < str.length; i += 8) {
    var size = Math.min(8, str.length - i);
    var value = parseInt(str.substring(i, i + size), radix);
    if (size < 8) {
      var power = goog.math.Long.fromNumber(Math.pow(radix, size));
      result = result.multiply(power).add(goog.math.Long.fromNumber(value));
    } else {
      result = result.multiply(radixToPower);
      result = result.add(goog.math.Long.fromNumber(value));
    }
  }
  return result;
};


// NOTE: the compiler should inline these constant values below and then remove
// these variables, so there should be no runtime penalty for these.


/**
 * Number used repeated below in calculations.  This must appear before the
 * first call to any from* function below.
 * @type {number}
 * @private
 */
goog.math.Long.TWO_PWR_16_DBL_ = 1 << 16;


/**
 * @type {number}
 * @private
 */
goog.math.Long.TWO_PWR_24_DBL_ = 1 << 24;


/**
 * @type {number}
 * @private
 */
goog.math.Long.TWO_PWR_32_DBL_ =
    goog.math.Long.TWO_PWR_16_DBL_ * goog.math.Long.TWO_PWR_16_DBL_;


/**
 * @type {number}
 * @private
 */
goog.math.Long.TWO_PWR_31_DBL_ =
    goog.math.Long.TWO_PWR_32_DBL_ / 2;


/**
 * @type {number}
 * @private
 */
goog.math.Long.TWO_PWR_48_DBL_ =
    goog.math.Long.TWO_PWR_32_DBL_ * goog.math.Long.TWO_PWR_16_DBL_;


/**
 * @type {number}
 * @private
 */
goog.math.Long.TWO_PWR_64_DBL_ =
    goog.math.Long.TWO_PWR_32_DBL_ * goog.math.Long.TWO_PWR_32_DBL_;


/**
 * @type {number}
 * @private
 */
goog.math.Long.TWO_PWR_63_DBL_ =
    goog.math.Long.TWO_PWR_64_DBL_ / 2;


/** @type {!goog.math.Long} */
goog.math.Long.ZERO = goog.math.Long.fromInt(0);


/** @type {!goog.math.Long} */
goog.math.Long.ONE = goog.math.Long.fromInt(1);


/** @type {!goog.math.Long} */
goog.math.Long.NEG_ONE = goog.math.Long.fromInt(-1);


/** @type {!goog.math.Long} */
goog.math.Long.MAX_VALUE =
    goog.math.Long.fromBits(0xFFFFFFFF | 0, 0x7FFFFFFF | 0);


/** @type {!goog.math.Long} */
goog.math.Long.MIN_VALUE = goog.math.Long.fromBits(0, 0x80000000 | 0);


/**
 * @type {!goog.math.Long}
 * @private
 */
goog.math.Long.TWO_PWR_24_ = goog.math.Long.fromInt(1 << 24);


/** @return {number} The value, assuming it is a 32-bit integer. */
goog.math.Long.prototype.toInt = function() {
  return this.low_;
};


/** @return {number} The closest floating-point representation to this value. */
goog.math.Long.prototype.toNumber = function() {
  return this.high_ * goog.math.Long.TWO_PWR_32_DBL_ +
         this.getLowBitsUnsigned();
};


/**
 * @param {number=} opt_radix The radix in which the text should be written.
 * @return {string} The textual representation of this value.
 * @override
 */
goog.math.Long.prototype.toString = function(opt_radix) {
  var radix = opt_radix || 10;
  if (radix < 2 || 36 < radix) {
    throw Error('radix out of range: ' + radix);
  }

  if (this.isZero()) {
    return '0';
  }

  if (this.isNegative()) {
    if (this.equals(goog.math.Long.MIN_VALUE)) {
      // We need to change the Long value before it can be negated, so we remove
      // the bottom-most digit in this base and then recurse to do the rest.
      var radixLong = goog.math.Long.fromNumber(radix);
      var div = this.div(radixLong);
      var rem = div.multiply(radixLong).subtract(this);
      return div.toString(radix) + rem.toInt().toString(radix);
    } else {
      return '-' + this.negate().toString(radix);
    }
  }

  // Do several (6) digits each time through the loop, so as to
  // minimize the calls to the very expensive emulated div.
  var radixToPower = goog.math.Long.fromNumber(Math.pow(radix, 6));

  var rem = this;
  var result = '';
  while (true) {
    var remDiv = rem.div(radixToPower);
    var intval = rem.subtract(remDiv.multiply(radixToPower)).toInt();
    var digits = intval.toString(radix);

    rem = remDiv;
    if (rem.isZero()) {
      return digits + result;
    } else {
      while (digits.length < 6) {
        digits = '0' + digits;
      }
      result = '' + digits + result;
    }
  }
};


/** @return {number} The high 32-bits as a signed value. */
goog.math.Long.prototype.getHighBits = function() {
  return this.high_;
};


/** @return {number} The low 32-bits as a signed value. */
goog.math.Long.prototype.getLowBits = function() {
  return this.low_;
};


/** @return {number} The low 32-bits as an unsigned value. */
goog.math.Long.prototype.getLowBitsUnsigned = function() {
  return (this.low_ >= 0) ?
      this.low_ : goog.math.Long.TWO_PWR_32_DBL_ + this.low_;
};


/**
 * @return {number} Returns the number of bits needed to represent the absolute
 *     value of this Long.
 */
goog.math.Long.prototype.getNumBitsAbs = function() {
  if (this.isNegative()) {
    if (this.equals(goog.math.Long.MIN_VALUE)) {
      return 64;
    } else {
      return this.negate().getNumBitsAbs();
    }
  } else {
    var val = this.high_ != 0 ? this.high_ : this.low_;
    for (var bit = 31; bit > 0; bit--) {
      if ((val & (1 << bit)) != 0) {
        break;
      }
    }
    return this.high_ != 0 ? bit + 33 : bit + 1;
  }
};


/** @return {boolean} Whether this value is zero. */
goog.math.Long.prototype.isZero = function() {
  return this.high_ == 0 && this.low_ == 0;
};


/** @return {boolean} Whether this value is negative. */
goog.math.Long.prototype.isNegative = function() {
  return this.high_ < 0;
};


/** @return {boolean} Whether this value is odd. */
goog.math.Long.prototype.isOdd = function() {
  return (this.low_ & 1) == 1;
};


/**
 * @param {goog.math.Long} other Long to compare against.
 * @return {boolean} Whether this Long equals the other.
 */
goog.math.Long.prototype.equals = function(other) {
  return (this.high_ == other.high_) && (this.low_ == other.low_);
};


/**
 * @param {goog.math.Long} other Long to compare against.
 * @return {boolean} Whether this Long does not equal the other.
 */
goog.math.Long.prototype.notEquals = function(other) {
  return (this.high_ != other.high_) || (this.low_ != other.low_);
};


/**
 * @param {goog.math.Long} other Long to compare against.
 * @return {boolean} Whether this Long is less than the other.
 */
goog.math.Long.prototype.lessThan = function(other) {
  return this.compare(other) < 0;
};


/**
 * @param {goog.math.Long} other Long to compare against.
 * @return {boolean} Whether this Long is less than or equal to the other.
 */
goog.math.Long.prototype.lessThanOrEqual = function(other) {
  return this.compare(other) <= 0;
};


/**
 * @param {goog.math.Long} other Long to compare against.
 * @return {boolean} Whether this Long is greater than the other.
 */
goog.math.Long.prototype.greaterThan = function(other) {
  return this.compare(other) > 0;
};


/**
 * @param {goog.math.Long} other Long to compare against.
 * @return {boolean} Whether this Long is greater than or equal to the other.
 */
goog.math.Long.prototype.greaterThanOrEqual = function(other) {
  return this.compare(other) >= 0;
};


/**
 * Compares this Long with the given one.
 * @param {goog.math.Long} other Long to compare against.
 * @return {number} 0 if they are the same, 1 if the this is greater, and -1
 *     if the given one is greater.
 */
goog.math.Long.prototype.compare = function(other) {
  if (this.equals(other)) {
    return 0;
  }

  var thisNeg = this.isNegative();
  var otherNeg = other.isNegative();
  if (thisNeg && !otherNeg) {
    return -1;
  }
  if (!thisNeg && otherNeg) {
    return 1;
  }

  // at this point, the signs are the same, so subtraction will not overflow
  if (this.subtract(other).isNegative()) {
    return -1;
  } else {
    return 1;
  }
};


/** @return {!goog.math.Long} The negation of this value. */
goog.math.Long.prototype.negate = function() {
  if (this.equals(goog.math.Long.MIN_VALUE)) {
    return goog.math.Long.MIN_VALUE;
  } else {
    return this.not().add(goog.math.Long.ONE);
  }
};


/**
 * Returns the sum of this and the given Long.
 * @param {goog.math.Long} other Long to add to this one.
 * @return {!goog.math.Long} The sum of this and the given Long.
 */
goog.math.Long.prototype.add = function(other) {
  // Divide each number into 4 chunks of 16 bits, and then sum the chunks.

  var a48 = this.high_ >>> 16;
  var a32 = this.high_ & 0xFFFF;
  var a16 = this.low_ >>> 16;
  var a00 = this.low_ & 0xFFFF;

  var b48 = other.high_ >>> 16;
  var b32 = other.high_ & 0xFFFF;
  var b16 = other.low_ >>> 16;
  var b00 = other.low_ & 0xFFFF;

  var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
  c00 += a00 + b00;
  c16 += c00 >>> 16;
  c00 &= 0xFFFF;
  c16 += a16 + b16;
  c32 += c16 >>> 16;
  c16 &= 0xFFFF;
  c32 += a32 + b32;
  c48 += c32 >>> 16;
  c32 &= 0xFFFF;
  c48 += a48 + b48;
  c48 &= 0xFFFF;
  return goog.math.Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32);
};


/**
 * Returns the difference of this and the given Long.
 * @param {goog.math.Long} other Long to subtract from this.
 * @return {!goog.math.Long} The difference of this and the given Long.
 */
goog.math.Long.prototype.subtract = function(other) {
  return this.add(other.negate());
};


/**
 * Returns the product of this and the given long.
 * @param {goog.math.Long} other Long to multiply with this.
 * @return {!goog.math.Long} The product of this and the other.
 */
goog.math.Long.prototype.multiply = function(other) {
  if (this.isZero()) {
    return goog.math.Long.ZERO;
  } else if (other.isZero()) {
    return goog.math.Long.ZERO;
  }

  if (this.equals(goog.math.Long.MIN_VALUE)) {
    return other.isOdd() ? goog.math.Long.MIN_VALUE : goog.math.Long.ZERO;
  } else if (other.equals(goog.math.Long.MIN_VALUE)) {
    return this.isOdd() ? goog.math.Long.MIN_VALUE : goog.math.Long.ZERO;
  }

  if (this.isNegative()) {
    if (other.isNegative()) {
      return this.negate().multiply(other.negate());
    } else {
      return this.negate().multiply(other).negate();
    }
  } else if (other.isNegative()) {
    return this.multiply(other.negate()).negate();
  }

  // If both longs are small, use float multiplication
  if (this.lessThan(goog.math.Long.TWO_PWR_24_) &&
      other.lessThan(goog.math.Long.TWO_PWR_24_)) {
    return goog.math.Long.fromNumber(this.toNumber() * other.toNumber());
  }

  // Divide each long into 4 chunks of 16 bits, and then add up 4x4 products.
  // We can skip products that would overflow.

  var a48 = this.high_ >>> 16;
  var a32 = this.high_ & 0xFFFF;
  var a16 = this.low_ >>> 16;
  var a00 = this.low_ & 0xFFFF;

  var b48 = other.high_ >>> 16;
  var b32 = other.high_ & 0xFFFF;
  var b16 = other.low_ >>> 16;
  var b00 = other.low_ & 0xFFFF;

  var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
  c00 += a00 * b00;
  c16 += c00 >>> 16;
  c00 &= 0xFFFF;
  c16 += a16 * b00;
  c32 += c16 >>> 16;
  c16 &= 0xFFFF;
  c16 += a00 * b16;
  c32 += c16 >>> 16;
  c16 &= 0xFFFF;
  c32 += a32 * b00;
  c48 += c32 >>> 16;
  c32 &= 0xFFFF;
  c32 += a16 * b16;
  c48 += c32 >>> 16;
  c32 &= 0xFFFF;
  c32 += a00 * b32;
  c48 += c32 >>> 16;
  c32 &= 0xFFFF;
  c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
  c48 &= 0xFFFF;
  return goog.math.Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32);
};


/**
 * Returns this Long divided by the given one.
 * @param {goog.math.Long} other Long by which to divide.
 * @return {!goog.math.Long} This Long divided by the given one.
 */
goog.math.Long.prototype.div = function(other) {
  if (other.isZero()) {
    throw Error('division by zero');
  } else if (this.isZero()) {
    return goog.math.Long.ZERO;
  }

  if (this.equals(goog.math.Long.MIN_VALUE)) {
    if (other.equals(goog.math.Long.ONE) ||
        other.equals(goog.math.Long.NEG_ONE)) {
      return goog.math.Long.MIN_VALUE;  // recall that -MIN_VALUE == MIN_VALUE
    } else if (other.equals(goog.math.Long.MIN_VALUE)) {
      return goog.math.Long.ONE;
    } else {
      // At this point, we have |other| >= 2, so |this/other| < |MIN_VALUE|.
      var halfThis = this.shiftRight(1);
      var approx = halfThis.div(other).shiftLeft(1);
      if (approx.equals(goog.math.Long.ZERO)) {
        return other.isNegative() ? goog.math.Long.ONE : goog.math.Long.NEG_ONE;
      } else {
        var rem = this.subtract(other.multiply(approx));
        var result = approx.add(rem.div(other));
        return result;
      }
    }
  } else if (other.equals(goog.math.Long.MIN_VALUE)) {
    return goog.math.Long.ZERO;
  }

  if (this.isNegative()) {
    if (other.isNegative()) {
      return this.negate().div(other.negate());
    } else {
      return this.negate().div(other).negate();
    }
  } else if (other.isNegative()) {
    return this.div(other.negate()).negate();
  }

  // Repeat the following until the remainder is less than other:  find a
  // floating-point that approximates remainder / other *from below*, add this
  // into the result, and subtract it from the remainder.  It is critical that
  // the approximate value is less than or equal to the real value so that the
  // remainder never becomes negative.
  var res = goog.math.Long.ZERO;
  var rem = this;
  while (rem.greaterThanOrEqual(other)) {
    // Approximate the result of division. This may be a little greater or
    // smaller than the actual value.
    var approx = Math.max(1, Math.floor(rem.toNumber() / other.toNumber()));

    // We will tweak the approximate result by changing it in the 48-th digit or
    // the smallest non-fractional digit, whichever is larger.
    var log2 = Math.ceil(Math.log(approx) / Math.LN2);
    var delta = (log2 <= 48) ? 1 : Math.pow(2, log2 - 48);

    // Decrease the approximation until it is smaller than the remainder.  Note
    // that if it is too large, the product overflows and is negative.
    var approxRes = goog.math.Long.fromNumber(approx);
    var approxRem = approxRes.multiply(other);
    while (approxRem.isNegative() || approxRem.greaterThan(rem)) {
      approx -= delta;
      approxRes = goog.math.Long.fromNumber(approx);
      approxRem = approxRes.multiply(other);
    }

    // We know the answer can't be zero... and actually, zero would cause
    // infinite recursion since we would make no progress.
    if (approxRes.isZero()) {
      approxRes = goog.math.Long.ONE;
    }

    res = res.add(approxRes);
    rem = rem.subtract(approxRem);
  }
  return res;
};


/**
 * Returns this Long modulo the given one.
 * @param {goog.math.Long} other Long by which to mod.
 * @return {!goog.math.Long} This Long modulo the given one.
 */
goog.math.Long.prototype.modulo = function(other) {
  return this.subtract(this.div(other).multiply(other));
};


/** @return {!goog.math.Long} The bitwise-NOT of this value. */
goog.math.Long.prototype.not = function() {
  return goog.math.Long.fromBits(~this.low_, ~this.high_);
};


/**
 * Returns the bitwise-AND of this Long and the given one.
 * @param {goog.math.Long} other The Long with which to AND.
 * @return {!goog.math.Long} The bitwise-AND of this and the other.
 */
goog.math.Long.prototype.and = function(other) {
  return goog.math.Long.fromBits(this.low_ & other.low_,
                                 this.high_ & other.high_);
};


/**
 * Returns the bitwise-OR of this Long and the given one.
 * @param {goog.math.Long} other The Long with which to OR.
 * @return {!goog.math.Long} The bitwise-OR of this and the other.
 */
goog.math.Long.prototype.or = function(other) {
  return goog.math.Long.fromBits(this.low_ | other.low_,
                                 this.high_ | other.high_);
};


/**
 * Returns the bitwise-XOR of this Long and the given one.
 * @param {goog.math.Long} other The Long with which to XOR.
 * @return {!goog.math.Long} The bitwise-XOR of this and the other.
 */
goog.math.Long.prototype.xor = function(other) {
  return goog.math.Long.fromBits(this.low_ ^ other.low_,
                                 this.high_ ^ other.high_);
};


/**
 * Returns this Long with bits shifted to the left by the given amount.
 * @param {number} numBits The number of bits by which to shift.
 * @return {!goog.math.Long} This shifted to the left by the given amount.
 */
goog.math.Long.prototype.shiftLeft = function(numBits) {
  numBits &= 63;
  if (numBits == 0) {
    return this;
  } else {
    var low = this.low_;
    if (numBits < 32) {
      var high = this.high_;
      return goog.math.Long.fromBits(
          low << numBits,
          (high << numBits) | (low >>> (32 - numBits)));
    } else {
      return goog.math.Long.fromBits(0, low << (numBits - 32));
    }
  }
};


/**
 * Returns this Long with bits shifted to the right by the given amount.
 * @param {number} numBits The number of bits by which to shift.
 * @return {!goog.math.Long} This shifted to the right by the given amount.
 */
goog.math.Long.prototype.shiftRight = function(numBits) {
  numBits &= 63;
  if (numBits == 0) {
    return this;
  } else {
    var high = this.high_;
    if (numBits < 32) {
      var low = this.low_;
      return goog.math.Long.fromBits(
          (low >>> numBits) | (high << (32 - numBits)),
          high >> numBits);
    } else {
      return goog.math.Long.fromBits(
          high >> (numBits - 32),
          high >= 0 ? 0 : -1);
    }
  }
};


/**
 * Returns this Long with bits shifted to the right by the given amount, with
 * zeros placed into the new leading bits.
 * @param {number} numBits The number of bits by which to shift.
 * @return {!goog.math.Long} This shifted to the right by the given amount, with
 *     zeros placed into the new leading bits.
 */
goog.math.Long.prototype.shiftRightUnsigned = function(numBits) {
  numBits &= 63;
  if (numBits == 0) {
    return this;
  } else {
    var high = this.high_;
    if (numBits < 32) {
      var low = this.low_;
      return goog.math.Long.fromBits(
          (low >>> numBits) | (high << (32 - numBits)),
          high >>> numBits);
    } else if (numBits == 32) {
      return goog.math.Long.fromBits(high, 0);
    } else {
      return goog.math.Long.fromBits(high >>> (numBits - 32), 0);
    }
  }
};

(function() {
  var Color,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __slice = [].slice;

  this.Punchdrunk = (function() {
    function Punchdrunk(config) {
      var conf, element, game_code, game_root, love, vm;
      if (config == null) {
        config = {};
      }
      game_root = config["game_root"] || "lua";
      game_code = config["game_code"];
      element = config["canvas"] || null;
      conf = {
        window: {},
        modules: {}
      };
      if (game_code) {
        Love.root = game_root;
        love = new Love(element, conf.window, conf.modules);
        vm = new shine.VM({
          love: love
        });
        vm.load(game_code);
        love.run();
      } else {
        new shine.FileManager().load("" + game_root + "/conf.lua.json", function(_, file) {
          var conf_env, conf_vm;
          if (file) {
            conf_env = {
              love: {}
            };
            conf_vm = new shine.VM(conf_env);
            conf_vm.execute(null, file);
            conf_env.love.conf.call(null, conf);
          }
          Love.root = game_root;
          love = new Love(element, conf.window, conf.modules);
          vm = new shine.VM({
            love: love
          });
          vm._globals['package'].path = ("" + game_root + "/?.lua.json;" + game_root + "/?.json;") + vm._globals['package'].path;
          return vm.load({
            "sourceName": "@js/boot.lua",
            "lineDefined": 0,
            "lastLineDefined": 0,
            "upvalueCount": 0,
            "paramCount": 0,
            "is_vararg": 2,
            "maxStackSize": 2,
            "instructions": [5, 0, 0, 0, 1, 1, 1, 0, 28, 0, 2, 1, 5, 0, 2, 0, 6, 0, 0, 259, 28, 0, 1, 1, 30, 0, 1, 0],
            "constants": ["require", "main", "love", "run"],
            "functions": [],
            "linePositions": [1, 1, 1, 3, 3, 3, 3],
            "locals": [],
            "upvalues": [],
            "sourcePath": "js/boot.lua"
          });
        });
      }
    }

    shine.stdout.write = function() {
      return console.log.apply(console, arguments);
    };

    return Punchdrunk;

  })();

  this.Love = (function() {
    function Love(element, window_conf, module_conf) {
      if (element == null) {
        element = null;
      }
      if (window_conf == null) {
        window_conf = {};
      }
      if (module_conf == null) {
        module_conf = {};
      }
      this.run = __bind(this.run, this);
      Love.element = element;
      this.graphics = new Love.Graphics(window_conf.width, window_conf.height);
      this.window = new Love.Window(this.graphics);
      this.timer = new Love.Timer();
      this.event = new Love.EventQueue();
      this.keyboard = new Love.Keyboard(this.event, Love.element);
      this.mouse = new Love.Mouse(this.event, Love.element);
      this.touch = new Love.Touch(this.event, Love.element);
      this.filesystem = new Love.FileSystem();
      this.audio = new Love.Audio();
      this.system = new Love.System();
      this.image = new Love.ImageModule();
      this.math = new Love.Math();
      window.addEventListener("beforeunload", (function(_this) {
        return function() {
          return _this.quit.call();
        };
      })(this));
    }

    Love.prototype.run = function() {
      var game_loop;
      this.timer.step();
      this.load.call();
      game_loop = (function(_this) {
        return function() {
          var e, _i, _len, _ref;
          _ref = _this.event.internalQueue;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            e = _ref[_i];
            _this[e.eventType].call(null, e.arg1, e.arg2, e.arg3, e.arg4);
          }
          _this.event.clear();
          _this.timer.step();
          _this.update.call(null, _this.timer.getDelta());
          _this.graphics.origin();
          _this.graphics.clear();
          _this.draw.call();
          return _this.timer.nextFrame(game_loop);
        };
      })(this);
      return this.timer.nextFrame(game_loop);
    };

    Love.prototype.load = function(args) {};

    Love.prototype.update = function(dt) {};

    Love.prototype.mousepressed = function(x, y, button) {};

    Love.prototype.mousereleased = function(x, y, button) {};

    Love.prototype.touchpressed = function(id, x, y) {};

    Love.prototype.touchreleased = function(id, x, y) {};

    Love.prototype.touchmoved = function(id, x, y) {};

    Love.prototype.keypressed = function(key, unicode) {};

    Love.prototype.keyreleased = function(key, unicode) {};

    Love.prototype.draw = function() {};

    Love.prototype.quit = function() {};

    return Love;

  })();

  Love.root = "lua";

  Love.element = null;

  Love.Audio = (function() {
    function Audio() {
      this.stop = __bind(this.stop, this);
      this.setVolume = __bind(this.setVolume, this);
      this.setVelocity = __bind(this.setVelocity, this);
      this.setPosition = __bind(this.setPosition, this);
      this.setOrientation = __bind(this.setOrientation, this);
      this.setDistanceModel = __bind(this.setDistanceModel, this);
      this.rewind = __bind(this.rewind, this);
      this.resume = __bind(this.resume, this);
      this.play = __bind(this.play, this);
      this.pause = __bind(this.pause, this);
      this.newSource = __bind(this.newSource, this);
      this.getVolume = __bind(this.getVolume, this);
      this.getVelocity = __bind(this.getVelocity, this);
      this.getSourceCount = __bind(this.getSourceCount, this);
      this.getPosition = __bind(this.getPosition, this);
      this.getOrientation = __bind(this.getOrientation, this);
      this.getDistanceModel = __bind(this.getDistanceModel, this);
    }

    Audio.prototype.getDistanceModel = function() {};

    Audio.prototype.getOrientation = function() {};

    Audio.prototype.getPosition = function() {};

    Audio.prototype.getSourceCount = function() {};

    Audio.prototype.getVelocity = function() {};

    Audio.prototype.getVolume = function() {};

    Audio.prototype.newSource = function(filename, type) {
      return new Love.Audio.Source(filename, type);
    };

    Audio.prototype.pause = function(source) {
      return source.pause(source);
    };

    Audio.prototype.play = function(source) {
      return source.play(source);
    };

    Audio.prototype.resume = function(source) {
      return source.play(source);
    };

    Audio.prototype.rewind = function(source) {
      return source.rewind(source);
    };

    Audio.prototype.setDistanceModel = function() {};

    Audio.prototype.setOrientation = function() {};

    Audio.prototype.setPosition = function() {};

    Audio.prototype.setVelocity = function() {};

    Audio.prototype.setVolume = function() {};

    Audio.prototype.stop = function(source) {
      return source.stop(source);
    };

    return Audio;

  })();

  Love.Color = (function() {
    function Color(r, g, b, a) {
      this.r = r;
      this.g = g;
      this.b = b;
      this.a = a != null ? a : 255;
      this.html_code = "rgb(" + this.r + ", " + this.g + ", " + this.b + ")";
    }

    Color.prototype.unpack = function() {
      return [this.r, this.g, this.b, this.a];
    };

    return Color;

  })();

  Color = Love.Color;

  Love.EventQueue = (function() {
    var Event;

    function EventQueue() {
      this.wait = __bind(this.wait, this);
      this.quit = __bind(this.quit, this);
      this.push = __bind(this.push, this);
      this.pump = __bind(this.pump, this);
      this.poll = __bind(this.poll, this);
      this.clear = __bind(this.clear, this);
      this.internalQueue = [];
    }

    EventQueue.prototype.clear = function() {
      return this.internalQueue = [];
    };

    EventQueue.prototype.poll = function() {};

    EventQueue.prototype.pump = function() {};

    EventQueue.prototype.push = function() {
      var args, eventType, newEvent;
      eventType = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      newEvent = (function(func, args, ctor) {
        ctor.prototype = func.prototype;
        var child = new ctor, result = func.apply(child, args);
        return Object(result) === result ? result : child;
      })(Event, [eventType].concat(__slice.call(args)), function(){});
      return this.internalQueue.push(newEvent);
    };

    EventQueue.prototype.quit = function() {
      return this.internalQueue.push(new Event("quit"));
    };

    EventQueue.prototype.wait = function() {};

    Event = (function() {
      function Event(eventType, arg1, arg2, arg3, arg4) {
        this.eventType = eventType;
        this.arg1 = arg1;
        this.arg2 = arg2;
        this.arg3 = arg3;
        this.arg4 = arg4;
      }

      return Event;

    })();

    return EventQueue;

  })();

  Love.Exception = (function() {
    function Exception(message) {
      this.message = message;
      this.name = "Love Error";
    }

    return Exception;

  })();

  Love.FileSystem = (function() {
    function FileSystem() {
      this.write = __bind(this.write, this);
      this.unmount = __bind(this.unmount, this);
      this.setSource = __bind(this.setSource, this);
      this.setIdentity = __bind(this.setIdentity, this);
      this.remove = __bind(this.remove, this);
      this.read = __bind(this.read, this);
      this.newFileData = __bind(this.newFileData, this);
      this.newFile = __bind(this.newFile, this);
      this.mount = __bind(this.mount, this);
      this.load = __bind(this.load, this);
      this.lines = __bind(this.lines, this);
      this.isFused = __bind(this.isFused, this);
      this.isFile = __bind(this.isFile, this);
      this.isDirectory = __bind(this.isDirectory, this);
      this.init = __bind(this.init, this);
      this.getWorkingDirectory = __bind(this.getWorkingDirectory, this);
      this.getUserDirectory = __bind(this.getUserDirectory, this);
      this.getSize = __bind(this.getSize, this);
      this.getSaveDirectory = __bind(this.getSaveDirectory, this);
      this.getLastModified = __bind(this.getLastModified, this);
      this.getIdentity = __bind(this.getIdentity, this);
      this.getDirectoryItems = __bind(this.getDirectoryItems, this);
      this.getAppdataDirectory = __bind(this.getAppdataDirectory, this);
      this.exists = __bind(this.exists, this);
      this.createDirectory = __bind(this.createDirectory, this);
      this.append = __bind(this.append, this);
    }

    FileSystem.prototype.append = function() {};

    FileSystem.prototype.createDirectory = function() {};

    FileSystem.prototype.exists = function(filename) {
      return localStorage.getItem(filename) !== null;
    };

    FileSystem.prototype.getAppdataDirectory = function() {};

    FileSystem.prototype.getDirectoryItems = function() {};

    FileSystem.prototype.getIdentity = function() {};

    FileSystem.prototype.getLastModified = function() {};

    FileSystem.prototype.getSaveDirectory = function() {};

    FileSystem.prototype.getSize = function() {};

    FileSystem.prototype.getUserDirectory = function() {};

    FileSystem.prototype.getWorkingDirectory = function() {};

    FileSystem.prototype.init = function() {};

    FileSystem.prototype.isDirectory = function() {};

    FileSystem.prototype.isFile = function() {};

    FileSystem.prototype.isFused = function() {};

    FileSystem.prototype.lines = function() {};

    FileSystem.prototype.load = function() {};

    FileSystem.prototype.mount = function() {};

    FileSystem.prototype.newFile = function() {};

    FileSystem.prototype.newFileData = function(contents, name, decoder) {
      return new Love.FileSystem.FileData(contents, name, decoder);
    };

    FileSystem.prototype.read = function(filename) {
      return localStorage.getItem(filename);
    };

    FileSystem.prototype.remove = function(filename) {
      return localStorage.removeItem(filename);
    };

    FileSystem.prototype.setIdentity = function() {};

    FileSystem.prototype.setSource = function() {};

    FileSystem.prototype.unmount = function() {};

    FileSystem.prototype.write = function(filename, data) {
      return localStorage.setItem(filename, data);
    };

    return FileSystem;

  })();

  Love.Graphics = (function() {
    function Graphics(width, height) {
      if (width == null) {
        width = 800;
      }
      if (height == null) {
        height = 600;
      }
      this.getWidth = __bind(this.getWidth, this);
      this.getHeight = __bind(this.getHeight, this);
      this.getDimensions = __bind(this.getDimensions, this);
      this.translate = __bind(this.translate, this);
      this.shear = __bind(this.shear, this);
      this.scale = __bind(this.scale, this);
      this.rotate = __bind(this.rotate, this);
      this.push = __bind(this.push, this);
      this.pop = __bind(this.pop, this);
      this.origin = __bind(this.origin, this);
      this.setWireframe = __bind(this.setWireframe, this);
      this.setStencil = __bind(this.setStencil, this);
      this.setShader = __bind(this.setShader, this);
      this.setScissor = __bind(this.setScissor, this);
      this.setPointStyle = __bind(this.setPointStyle, this);
      this.setPointSize = __bind(this.setPointSize, this);
      this.setLineWidth = __bind(this.setLineWidth, this);
      this.setLineStyle = __bind(this.setLineStyle, this);
      this.setLineJoin = __bind(this.setLineJoin, this);
      this.setInvertedStencil = __bind(this.setInvertedStencil, this);
      this.setDefaultFilter = __bind(this.setDefaultFilter, this);
      this.setColorMask = __bind(this.setColorMask, this);
      this.setFont = __bind(this.setFont, this);
      this.setColor = __bind(this.setColor, this);
      this.setCanvas = __bind(this.setCanvas, this);
      this.setBlendMode = __bind(this.setBlendMode, this);
      this.setBackgroundColor = __bind(this.setBackgroundColor, this);
      this.reset = __bind(this.reset, this);
      this.isWireframe = __bind(this.isWireframe, this);
      this.isSupported = __bind(this.isSupported, this);
      this.getSystemLimit = __bind(this.getSystemLimit, this);
      this.getShader = __bind(this.getShader, this);
      this.getScissor = __bind(this.getScissor, this);
      this.getRendererInfo = __bind(this.getRendererInfo, this);
      this.getPointStyle = __bind(this.getPointStyle, this);
      this.getPointSize = __bind(this.getPointSize, this);
      this.getMaxPointSize = __bind(this.getMaxPointSize, this);
      this.getMaxImageSize = __bind(this.getMaxImageSize, this);
      this.getLineWidth = __bind(this.getLineWidth, this);
      this.getLineStyle = __bind(this.getLineStyle, this);
      this.getLineJoin = __bind(this.getLineJoin, this);
      this.getFont = __bind(this.getFont, this);
      this.getDefaultFilter = __bind(this.getDefaultFilter, this);
      this.getColorMask = __bind(this.getColorMask, this);
      this.getColor = __bind(this.getColor, this);
      this.getCanvas = __bind(this.getCanvas, this);
      this.getBlendMode = __bind(this.getBlendMode, this);
      this.getBackgroundColor = __bind(this.getBackgroundColor, this);
      this.setNewFont = __bind(this.setNewFont, this);
      this.newSpriteBatch = __bind(this.newSpriteBatch, this);
      this.newShader = __bind(this.newShader, this);
      this.newScreenshot = __bind(this.newScreenshot, this);
      this.newQuad = __bind(this.newQuad, this);
      this.newParticleSystem = __bind(this.newParticleSystem, this);
      this.newMesh = __bind(this.newMesh, this);
      this.newImageFont = __bind(this.newImageFont, this);
      this.newImage = __bind(this.newImage, this);
      this.newFont = __bind(this.newFont, this);
      this.newCanvas = __bind(this.newCanvas, this);
      this.rectangle = __bind(this.rectangle, this);
      this.printf = __bind(this.printf, this);
      this.print = __bind(this.print, this);
      this.polygon = __bind(this.polygon, this);
      this.point = __bind(this.point, this);
      this.line = __bind(this.line, this);
      this.draw = __bind(this.draw, this);
      this.clear = __bind(this.clear, this);
      this.circle = __bind(this.circle, this);
      this.arc = __bind(this.arc, this);
      if (Love.element) {
        this.canvas = new Love.Graphics.Canvas2D(width, height, Love.element);
      } else {
        this.canvas = new Love.Graphics.Canvas2D(width, height);
        document.body.appendChild(this.canvas.element);
        Love.element = this.canvas.element;
      }
      this.default_canvas = this.canvas;
      this.default_font = new Love.Graphics.Font("Vera", 12);
      this.setColor(255, 255, 255);
      this.setBackgroundColor(0, 0, 0);
      this.setFont(this.default_font);
    }

    Graphics.prototype.arc = function(mode, x, y, radius, startAngle, endAngle, segments) {
      return this.canvas.arc(mode, x, y, radius, startAngle, endAngle, segments);
    };

    Graphics.prototype.circle = function(mode, x, y, radius, segments) {
      return this.canvas.circle(mode, x, y, radius, segments);
    };

    Graphics.prototype.clear = function() {
      var a, b, g, r, _ref;
      _ref = this.getBackgroundColor(), r = _ref[0], g = _ref[1], b = _ref[2], a = _ref[3];
      return this.canvas.clear(this.canvas, r, g, b, a);
    };

    Graphics.prototype.draw = function() {
      var args, _ref;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return (_ref = this.canvas).draw.apply(_ref, args);
    };

    Graphics.prototype.line = function() {
      var points, _ref;
      points = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return (_ref = this.canvas).line.apply(_ref, points);
    };

    Graphics.prototype.point = function(x, y) {
      return this.canvas.point(x, y);
    };

    Graphics.prototype.polygon = function() {
      var mode, points, _ref;
      mode = arguments[0], points = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      return (_ref = this.canvas).polygon.apply(_ref, [mode].concat(__slice.call(points)));
    };

    Graphics.prototype.print = function(text, x, y) {
      return this.canvas.print(text, x, y);
    };

    Graphics.prototype.printf = function(text, x, y, limit, align) {
      if (align == null) {
        align = "left";
      }
      return this.canvas.printf(text, x, y, limit, align);
    };

    Graphics.prototype.rectangle = function(mode, x, y, width, height) {
      return this.canvas.rectangle(mode, x, y, width, height);
    };

    Graphics.prototype.newCanvas = function(width, height) {
      if (width == null) {
        width = this.getWidth(this);
      }
      if (height == null) {
        height = this.getHeight(this);
      }
      return new Love.Graphics.Canvas2D(width, height);
    };

    Graphics.prototype.newFont = function(filename, size) {
      if (size == null) {
        size = 12;
      }
      return new Love.Graphics.Font(filename, size);
    };

    Graphics.prototype.newImage = function(data) {
      return new Love.Graphics.Image(data);
    };

    Graphics.prototype.newImageFont = function() {};

    Graphics.prototype.newMesh = function() {};

    Graphics.prototype.newParticleSystem = function() {};

    Graphics.prototype.newQuad = function(x, y, width, height, sw, sh) {
      return new Love.Graphics.Quad(x, y, width, height, sw, sh);
    };

    Graphics.prototype.newScreenshot = function() {};

    Graphics.prototype.newShader = function() {};

    Graphics.prototype.newSpriteBatch = function() {};

    Graphics.prototype.setNewFont = function(filename, size) {
      var font;
      font = this.newFont(filename, size);
      return this.setFont(font);
    };

    Graphics.prototype.getBackgroundColor = function() {
      return this.canvas.getBackgroundColor();
    };

    Graphics.prototype.getBlendMode = function() {
      return this.canvas.getBlendMode();
    };

    Graphics.prototype.getCanvas = function() {
      return this.canvas;
    };

    Graphics.prototype.getColor = function() {
      return this.canvas.getColor();
    };

    Graphics.prototype.getColorMask = function() {
      return this.canvas.getColorMask();
    };

    Graphics.prototype.getDefaultFilter = function() {
      return this.canvas.getDefaultFilter();
    };

    Graphics.prototype.getFont = function() {
      return this.canvas.getFont();
    };

    Graphics.prototype.getLineJoin = function() {
      return this.canvas.getLineJoin();
    };

    Graphics.prototype.getLineStyle = function() {
      return this.canvas.getLineStyle();
    };

    Graphics.prototype.getLineWidth = function() {
      return this.canvas.getLineWidth();
    };

    Graphics.prototype.getMaxImageSize = function() {
      return this.canvas.getMaxImageSize();
    };

    Graphics.prototype.getMaxPointSize = function() {
      return this.canvas.getMaxPointSize();
    };

    Graphics.prototype.getPointSize = function() {
      return this.canvas.getPointSize();
    };

    Graphics.prototype.getPointStyle = function() {
      return this.canvas.getPointStyle();
    };

    Graphics.prototype.getRendererInfo = function() {
      return this.canvas.getRendererInfo();
    };

    Graphics.prototype.getScissor = function() {
      return this.canvas.getScissor();
    };

    Graphics.prototype.getShader = function() {
      return this.canvas.getShader();
    };

    Graphics.prototype.getSystemLimit = function() {
      return this.canvas.getSystemLimit();
    };

    Graphics.prototype.isSupported = function() {};

    Graphics.prototype.isWireframe = function() {
      return this.canvas.isWireframe();
    };

    Graphics.prototype.reset = function() {
      this.setCanvas();
      return this.origin();
    };

    Graphics.prototype.setBackgroundColor = function(r, g, b, a) {
      if (a == null) {
        a = 255;
      }
      return this.canvas.setBackgroundColor(r, g, b, a);
    };

    Graphics.prototype.setBlendMode = function(mode) {
      return this.canvas.setBlendMode(mode);
    };

    Graphics.prototype.setCanvas = function(canvas) {
      if (canvas === void 0 || canvas === null) {
        this.default_canvas.copyContext(this.canvas.context);
        return this.canvas = this.default_canvas;
      } else {
        canvas.copyContext(this.canvas.context);
        return this.canvas = canvas;
      }
    };

    Graphics.prototype.setColor = function(r, g, b, a) {
      if (a == null) {
        a = 255;
      }
      return this.canvas.setColor(r, g, b, a);
    };

    Graphics.prototype.setFont = function(font) {
      return this.canvas.setFont(font);
    };

    Graphics.prototype.setColorMask = function(r, g, b, a) {
      return this.canvas.setColorMask(r, g, b, a);
    };

    Graphics.prototype.setDefaultFilter = function(min, mag, anisotropy) {
      return this.canvas.setDefaultFilter(min, mag, anisotropy);
    };

    Graphics.prototype.setInvertedStencil = function(callback) {
      return this.canvas.setInvertedStencil(callback);
    };

    Graphics.prototype.setLineJoin = function(join) {
      return this.canvas.setLineJoin(join);
    };

    Graphics.prototype.setLineStyle = function(style) {
      return this.canvas.setLineStyle(style);
    };

    Graphics.prototype.setLineWidth = function(width) {
      return this.canvas.setLineWidth(width);
    };

    Graphics.prototype.setPointSize = function(size) {
      return this.canvas.setPointSize(size);
    };

    Graphics.prototype.setPointStyle = function(style) {
      return this.canvas.setPointStyle(style);
    };

    Graphics.prototype.setScissor = function(x, y, width, height) {
      return this.canvas.setScissor(x, y, width, height);
    };

    Graphics.prototype.setShader = function(shader) {
      return this.canvas.setShader(shader);
    };

    Graphics.prototype.setStencil = function(callback) {
      return this.canvas.setStencil(callback);
    };

    Graphics.prototype.setWireframe = function(enable) {
      return this.canvas.setWireframe(enable);
    };

    Graphics.prototype.origin = function() {
      return this.canvas.origin();
    };

    Graphics.prototype.pop = function() {
      return this.canvas.pop();
    };

    Graphics.prototype.push = function() {
      return this.canvas.push();
    };

    Graphics.prototype.rotate = function(r) {
      return this.canvas.rotate(r);
    };

    Graphics.prototype.scale = function(sx, sy) {
      if (sy == null) {
        sy = sx;
      }
      return this.canvas.scale(sx, sy);
    };

    Graphics.prototype.shear = function(kx, ky) {
      return this.canvas.shear(kx, ky);
    };

    Graphics.prototype.translate = function(dx, dy) {
      return this.canvas.translate(dx, dy);
    };

    Graphics.prototype.getDimensions = function() {
      return [this.getWidth(), this.getHeight()];
    };

    Graphics.prototype.getHeight = function() {
      return this.default_canvas.getHeight(this.default_canvas);
    };

    Graphics.prototype.getWidth = function() {
      return this.default_canvas.getWidth(this.default_canvas);
    };

    return Graphics;

  })();

  Love.ImageModule = (function() {
    function ImageModule() {
      this.newImageData = __bind(this.newImageData, this);
      this.newCompressedData = __bind(this.newCompressedData, this);
      this.isCompressed = __bind(this.isCompressed, this);
    }

    ImageModule.prototype.isCompressed = function() {};

    ImageModule.prototype.newCompressedData = function() {};

    ImageModule.prototype.newImageData = function(filedata) {
      return new Love.ImageModule.ImageData(filedata);
    };

    return ImageModule;

  })();

  Love.Keyboard = (function() {
    var getKeyFromEvent, keys, rightKeys, shiftedKeys;

    function Keyboard(eventQueue, canvas) {
      this.isDown = __bind(this.isDown, this);
      var keydown, keyup;
      this.keysDown = {};
      canvas.setAttribute("tabindex", "0");
      keydown = (function(_this) {
        return function(evt) {
          var key;
          evt.preventDefault();
          evt.stopPropagation();
          key = getKeyFromEvent(evt);
          _this.keysDown[key] = true;
          return eventQueue.push("keypressed", key, evt.which);
        };
      })(this);
      canvas.addEventListener("keydown", keydown, true);
      keyup = (function(_this) {
        return function(evt) {
          var key;
          evt.preventDefault();
          evt.stopPropagation();
          key = getKeyFromEvent(evt);
          _this.keysDown[key] = false;
          return eventQueue.push("keyreleased", key, evt.which);
        };
      })(this);
      canvas.addEventListener("keyup", keyup, true);
    }

    Keyboard.prototype.isDown = function() {
      var key, others;
      key = arguments[0], others = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      if (!this.keysDown[key]) {
        return false;
      } else {
        if (others.length === 0) {
          return true;
        } else {
          return this.isDown.apply(this, others);
        }
      }
    };

    keys = {
      8: "backspace",
      9: "tab",
      13: "return",
      16: "shift",
      17: "ctrl",
      18: "alt",
      19: "pause",
      20: "capslock",
      27: "escape",
      33: "pageup",
      34: "pagedown",
      35: "end",
      36: "home",
      45: "insert",
      46: "delete",
      37: "left",
      38: "up",
      39: "right",
      40: "down",
      91: "lmeta",
      92: "rmeta",
      93: "mode",
      96: "kp0",
      97: "kp1",
      98: "kp2",
      99: "kp3",
      100: "kp4",
      101: "kp5",
      102: "kp6",
      103: "kp7",
      104: "kp8",
      105: "kp9",
      106: "kp*",
      107: "kp+",
      109: "kp-",
      110: "kp.",
      111: "kp/",
      112: "f1",
      113: "f2",
      114: "f3",
      115: "f4",
      116: "f5",
      117: "f6",
      118: "f7",
      119: "f8",
      120: "f9",
      121: "f10",
      122: "f11",
      123: "f12",
      144: "numlock",
      145: "scrolllock",
      186: ",",
      187: "=",
      188: ",",
      189: "-",
      190: ".",
      191: "/",
      192: "`",
      219: "[",
      220: "\\",
      221: "]",
      222: "'"
    };

    shiftedKeys = {
      192: "~",
      48: ")",
      49: "!",
      50: "@",
      51: "#",
      52: "$",
      53: "%",
      54: "^",
      55: "&",
      56: "*",
      57: "(",
      109: "_",
      61: "+",
      219: "{",
      221: "}",
      220: "|",
      59: ":",
      222: "\"",
      188: "<",
      189: ">",
      191: "?",
      96: "insert",
      97: "end",
      98: "down",
      99: "pagedown",
      100: "left",
      102: "right",
      103: "home",
      104: "up",
      105: "pageup"
    };

    rightKeys = {
      16: "rshift",
      17: "rctrl",
      18: "ralt"
    };

    getKeyFromEvent = function(event) {
      var code, key;
      code = event.which;
      if (event.location && event.location > 1) {
        key = rightKeys[code];
      } else if (event.shiftKey) {
        key = shiftedKeys[code] || keys[code];
      } else {
        key = keys[code];
      }
      if (typeof key === "undefined") {
        key = String.fromCharCode(code);
        if (!event.shiftKey) {
          key = key.toLowerCase();
        }
      }
      return key;
    };

    return Keyboard;

  })();

  Love.Math = (function() {
    var any_point_in_triangle, getGammaArgs, is_ear, is_oriented_ccw, on_same_side, point_in_triangle, toPolygon;

    function Math() {
      this.triangulate = __bind(this.triangulate, this);
      this.setRandomSeed = __bind(this.setRandomSeed, this);
      this.randomNormal = __bind(this.randomNormal, this);
      this.random = __bind(this.random, this);
      this.noise = __bind(this.noise, this);
      this.newRandomGenerator = __bind(this.newRandomGenerator, this);
      this.newBezierCurve = __bind(this.newBezierCurve, this);
      this.linearToGamma = __bind(this.linearToGamma, this);
      this.isConvex = __bind(this.isConvex, this);
      this.getRandomSeed = __bind(this.getRandomSeed, this);
      this.gammaToLinear = __bind(this.gammaToLinear, this);
      var simplex_r;
      this.random_generator = new Love.Math.RandomGenerator();
      simplex_r = new Love.Math.RandomGenerator();
      this.simplex = new SimplexNoise(simplex_r.random.bind(simplex_r, simplex_r));
    }

    Math.prototype.gammaToLinear = function() {
      var c, gamma_colors, _i, _len, _results;
      gamma_colors = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      gamma_colors = getGammaArgs(gamma_colors);
      _results = [];
      for (_i = 0, _len = gamma_colors.length; _i < _len; _i++) {
        c = gamma_colors[_i];
        c /= 255;
        if (c > 1) {
          c = 1;
        } else if (c < 0) {
          c = 0;
        } else if (c < 0.0031308) {
          c *= 12.92;
        } else {
          c = 1.055 * window.Math.pow(c, 0.41666) - 0.055;
        }
        _results.push(c *= 255);
      }
      return _results;
    };

    Math.prototype.getRandomSeed = function() {
      return this.random_generator.getSeed(this.random_generator);
    };

    Math.prototype.isConvex = function() {
      var i, j, k, p, polygon, q, vertices, winding;
      vertices = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      polygon = toPolygon(vertices);
      i = polygon.length - 2;
      j = polygon.length - 1;
      k = 0;
      p = {
        x: polygon[j].x - polygon[i].x,
        y: polygon[j].y - polygon[i].y
      };
      q = {
        x: polygon[k].x - polygon[j].x,
        y: polygon[k].y - polygon[j].y
      };
      winding = p.x * q.y - p.y * q.x;
      while (k + 1 < polygon.length) {
        i = j;
        j = k;
        k++;
        p.x = polygon[j].x - polygon[i].x;
        p.y = polygon[j].y - polygon[i].y;
        q.x = polygon[k].x - polygon[j].x;
        q.y = polygon[k].y - polygon[j].y;
        if ((p.x * q.y - p.y * q.x) * winding < 0) {
          return false;
        }
      }
      return true;
    };

    Math.prototype.linearToGamma = function() {
      var c, linear_colors, _i, _len, _results;
      linear_colors = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      linear_colors = getGammaArgs(linear_colors);
      _results = [];
      for (_i = 0, _len = linear_colors.length; _i < _len; _i++) {
        c = linear_colors[_i];
        c /= 255;
        if (c > 1) {
          c = 1;
        } else if (c < 0) {
          c = 0;
        } else if (c <= 0.04045) {
          c /= 12.92;
        } else {
          c = window.Math.pow((c + 0.055) / 1.055, 2.4);
        }
        _results.push(c *= 255);
      }
      return _results;
    };

    Math.prototype.newBezierCurve = function() {
      var controlPoints, i, vertices;
      vertices = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      if (vertices.length === 1) {
        vertices = vertices[0].__shine ? vertices[0].__shine.numValues.slice(1, vertices[0].__shine.numValues.length) : vertices[0];
      }
      controlPoints = (function() {
        var _i, _ref, _results;
        _results = [];
        for (i = _i = 0, _ref = vertices.length; _i < _ref; i = _i += 2) {
          _results.push({
            x: vertices[i],
            y: vertices[i + 1]
          });
        }
        return _results;
      })();
      return new this.constructor.BezierCurve(controlPoints);
    };

    Math.prototype.newRandomGenerator = function(low, high) {
      var r;
      r = new Love.Math.RandomGenerator();
      if (low) {
        r.setSeed(r, low, high);
      }
      return r;
    };

    Math.prototype.noise = function() {
      var dimensions;
      dimensions = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      switch (dimensions.length) {
        case 1:
          return this.simplex.noise1D(dimensions[0]);
        case 2:
          return this.simplex.noise2D(dimensions[0], dimensions[1]);
        case 3:
          return this.simplex.noise3D(dimensions[0], dimensions[1], dimensions[2]);
        case 4:
          return this.simplex.noise4D(dimensions[0], dimensions[1], dimensions[2], dimensions[3]);
      }
    };

    Math.prototype.random = function(min, max) {
      return this.random_generator.random(this.random_generator, min, max);
    };

    Math.prototype.randomNormal = function(stddev, mean) {
      if (stddev == null) {
        stddev = 1;
      }
      if (mean == null) {
        mean = 0;
      }
      return this.random_generator.randomNormal(this.random_generator, stddev, mean);
    };

    Math.prototype.setRandomSeed = function(low, high) {
      return this.random_generator.setSeed(this.random_generator, low, high);
    };

    Math.prototype.triangulate = function() {
      var a, b, c, concave_vertices, current, i, idx_lm, lm, n_vertices, next, next_idx, p, polygon, prev, prev_idx, skipped, triangles, vertices, _i, _j, _ref, _ref1, _ref2, _ref3;
      vertices = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      polygon = toPolygon(vertices);
      next_idx = new Array(polygon.length);
      prev_idx = new Array(polygon.length);
      idx_lm = 0;
      for (i = _i = 0, _ref = polygon.length; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
        lm = polygon[idx_lm];
        p = polygon[i];
        if (p.x < lm.x || (p.x === lm.x && p.y < lm.y)) {
          idx_lm = i;
        }
        next_idx[i] = i + 1;
        prev_idx[i] = i - 1;
      }
      next_idx[next_idx.length - 1] = 0;
      prev_idx[0] = prev_idx.length - 1;
      if (!is_oriented_ccw(polygon[prev_idx[idx_lm]], polygon[idx_lm], polygon[next_idx[idx_lm]])) {
        _ref1 = [prev_idx, next_idx], next_idx = _ref1[0], prev_idx = _ref1[1];
      }
      concave_vertices = [];
      for (i = _j = 0, _ref2 = polygon.length; 0 <= _ref2 ? _j < _ref2 : _j > _ref2; i = 0 <= _ref2 ? ++_j : --_j) {
        if (!is_oriented_ccw(polygon[prev_idx[i]], polygon[i], polygon[next_idx[i]])) {
          concave_vertices.push(polygon[i]);
        }
      }
      triangles = [];
      n_vertices = polygon.length;
      _ref3 = [1, 0], current = _ref3[0], skipped = _ref3[1], next = _ref3[2], prev = _ref3[3];
      while (n_vertices > 3) {
        next = next_idx[current];
        prev = prev_idx[current];
        a = polygon[prev];
        b = polygon[current];
        c = polygon[next];
        if (is_ear(a, b, c, concave_vertices)) {
          triangles.push([a, b, c]);
          next_idx[prev] = next;
          prev_idx[next] = prev;
          concave_vertices.splice(concave_vertices.indexOf(b), 1);
          --n_vertices;
          skipped = 0;
        } else if (++skipped > n_vertices) {
          console.log("Cannot triangulate polygon.");
        }
        current = next;
      }
      next = next_idx[current];
      prev = prev_idx[current];
      triangles.push([polygon[prev], polygon[current], polygon[next]]);
      return triangles;
    };

    getGammaArgs = function(colors) {
      if (colors.length === 1 && colors[0] instanceof Object) {
        return colors = colors[0].__shine ? colors[0].__shine.numValues.slice(1, colors[0].__shine.numValues.length) : colors[0];
      } else {
        return colors;
      }
    };

    toPolygon = function(vertices) {
      var i, _i, _ref, _results;
      if (vertices.length === 1) {
        vertices = vertices[0].__shine ? vertices[0].__shine.numValues.slice(1, vertices[0].__shine.numValues.length) : vertices[0];
      }
      _results = [];
      for (i = _i = 0, _ref = vertices.length; _i < _ref; i = _i += 2) {
        _results.push({
          x: vertices[i],
          y: vertices[i + 1]
        });
      }
      return _results;
    };

    is_oriented_ccw = function(a, b, c) {
      return ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) >= 0;
    };

    on_same_side = function(a, b, c, d) {
      var l, m, px, py;
      px = d.x - c.x;
      py = d.y - c.y;
      l = px * (a.y - c.y) - py * (a.x - c.x);
      m = px * (b.y - c.y) - py * (b.x - c.x);
      return l * m >= 0;
    };

    point_in_triangle = function(p, a, b, c) {
      return on_same_side(p, a, b, c) && on_same_side(p, b, a, c) && on_same_side(p, c, a, b);
    };

    any_point_in_triangle = function(vertices, a, b, c) {
      var p, _i, _len;
      for (_i = 0, _len = vertices.length; _i < _len; _i++) {
        p = vertices[_i];
        if ((p.x !== a.x && p.y !== a.y) && (p.x !== b.x && p.y !== a.y) && (p.x !== c.x && p.y !== a.y) && point_in_triangle(p, a, b, c)) {
          true;
        }
      }
      return false;
    };

    is_ear = function(a, b, c, vertices) {
      return is_oriented_ccw(a, b, c) && !any_point_in_triangle(vertices, a, b, c);
    };

    return Math;

  })();

  Love.Mouse = (function() {
    var getButtonFromEvent, getWheelButtonFromEvent, mouseButtonNames;

    Mouse.WHEEL_TIMEOUT = 0.02;

    function Mouse(eventQueue, canvas) {
      this.setY = __bind(this.setY, this);
      this.setX = __bind(this.setX, this);
      this.setVisible = __bind(this.setVisible, this);
      this.setPosition = __bind(this.setPosition, this);
      this.setGrabbed = __bind(this.setGrabbed, this);
      this.setCursor = __bind(this.setCursor, this);
      this.newCursor = __bind(this.newCursor, this);
      this.isVisible = __bind(this.isVisible, this);
      this.isGrabbed = __bind(this.isGrabbed, this);
      this.isDown = __bind(this.isDown, this);
      this.getY = __bind(this.getY, this);
      this.getX = __bind(this.getX, this);
      this.getSystemCursor = __bind(this.getSystemCursor, this);
      this.getPosition = __bind(this.getPosition, this);
      this.getCursor = __bind(this.getCursor, this);
      var handlePress, handleRelease, handleWheel;
      this.x = 0;
      this.y = 0;
      this.buttonsDown = {};
      this.wheelTimeOuts = {};
      handlePress = (function(_this) {
        return function(button) {
          _this.buttonsDown[button] = true;
          return eventQueue.push("mousepressed", _this.x, _this.y, button);
        };
      })(this);
      handleRelease = (function(_this) {
        return function(button) {
          _this.buttonsDown[button] = false;
          return eventQueue.push("mousereleased", _this.x, _this.y, button);
        };
      })(this);
      handleWheel = (function(_this) {
        return function(evt) {
          var button;
          evt.preventDefault();
          button = getWheelButtonFromEvent(evt);
          clearTimeout(_this.wheelTimeOuts[button]);
          _this.wheelTimeOuts[button] = setTimeout(function() {
            return handleRelease(button);
          }, _this.constructor.WHEEL_TIMEOUT * 1000);
          return handlePress(button);
        };
      })(this);
      canvas.addEventListener('mousemove', (function(_this) {
        return function(evt) {
          var rect;
          rect = Love.element.getBoundingClientRect();
          _this.x = evt.pageX - rect.left;
          return _this.y = evt.pageY - rect.top;
        };
      })(this));
      canvas.addEventListener('mousedown', (function(_this) {
        return function(evt) {
          return handlePress(getButtonFromEvent(evt));
        };
      })(this));
      canvas.addEventListener('mouseup', (function(_this) {
        return function(evt) {
          return handleRelease(getButtonFromEvent(evt));
        };
      })(this));
      canvas.addEventListener('DOMMouseScroll', handleWheel);
      canvas.addEventListener('mousewheel', handleWheel);
    }

    Mouse.prototype.getCursor = function() {
      return null;
    };

    Mouse.prototype.getPosition = function() {
      return [this.x, this.y];
    };

    Mouse.prototype.getSystemCursor = function() {
      return null;
    };

    Mouse.prototype.getX = function() {
      return this.x;
    };

    Mouse.prototype.getY = function() {
      return this.y;
    };

    Mouse.prototype.isDown = function() {
      var button, others;
      button = arguments[0], others = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      if (!this.buttonsDown[button]) {
        return false;
      } else {
        if (others.length === 0) {
          return true;
        } else {
          return this.isDown.apply(this, others);
        }
      }
    };

    Mouse.prototype.isGrabbed = function() {
      return false;
    };

    Mouse.prototype.isVisible = function() {
      return true;
    };

    Mouse.prototype.newCursor = function() {
      return null;
    };

    Mouse.prototype.setCursor = function(cursor) {};

    Mouse.prototype.setGrabbed = function(grab) {};

    Mouse.prototype.setPosition = function(x, y) {
      this.setX(x);
      return this.setY(y);
    };

    Mouse.prototype.setVisible = function(visible) {};

    Mouse.prototype.setX = function(x) {};

    Mouse.prototype.setY = function(y) {};

    mouseButtonNames = {
      1: "l",
      2: "m",
      3: "r"
    };

    getButtonFromEvent = function(evt) {
      return mouseButtonNames[evt.which];
    };

    getWheelButtonFromEvent = function(evt) {
      var delta;
      delta = Math.max(-1, Math.min(1, evt.wheelDelta || -evt.detail));
      if (delta === 1) {
        return 'wu';
      } else {
        return 'wd';
      }
    };

    return Mouse;

  })();

  Love.System = (function() {
    function System() {
      this.setClipboardText = __bind(this.setClipboardText, this);
      this.openURL = __bind(this.openURL, this);
      this.getProcessorCount = __bind(this.getProcessorCount, this);
      this.getPowerInfo = __bind(this.getPowerInfo, this);
      this.getOS = __bind(this.getOS, this);
      this.getClipboardText = __bind(this.getClipboardText, this);
    }

    System.prototype.getClipboardText = function() {};

    System.prototype.getOS = function() {
      return window.navigator.appVersion;
    };

    System.prototype.getPowerInfo = function() {
      var battery, percent, seconds, state;
      battery = window.navigator.battery;
      if (battery) {
        state = battery.charging ? "charging" : "unknown";
        percent = battery.level * 100;
        seconds = battery.dischargingTime;
        return [state, percent, seconds];
      } else {
        return ["unknown", null, null];
      }
    };

    System.prototype.getProcessorCount = function() {
      return window.navigator.hardwareConcurrency || 1;
    };

    System.prototype.openURL = function(url) {
      return window.open(url);
    };

    System.prototype.setClipboardText = function(text) {};

    return System;

  })();

  Love.Timer = (function() {
    var lastTime, performance, requestAnimationFrame;

    function Timer() {
      this.step = __bind(this.step, this);
      this.sleep = __bind(this.sleep, this);
      this.getTime = __bind(this.getTime, this);
      this.getFPS = __bind(this.getFPS, this);
      this.getDelta = __bind(this.getDelta, this);
      this.nextFrame = __bind(this.nextFrame, this);
      this.microTime = performance.now();
      this.deltaTime = 0;
      this.deltaTimeLimit = 0.25;
      this.events = {};
      this.maxEventId = 0;
    }

    Timer.prototype.nextFrame = function(callback) {
      return requestAnimationFrame(callback);
    };

    Timer.prototype.getDelta = function() {
      return this.deltaTime;
    };

    Timer.prototype.getFPS = function() {
      if (this.deltaTime === 0) {
        return 0;
      } else {
        return 1 / this.deltaTime;
      }
    };

    Timer.prototype.getTime = function() {
      return this.microTime;
    };

    Timer.prototype.sleep = function() {};

    Timer.prototype.step = function() {
      var dt;
      dt = (performance.now() - this.microTime) / 1000;
      this.deltaTime = Math.max(0, Math.min(this.deltaTimeLimit, dt));
      return this.microTime += dt * 1000;
    };

    performance = window.performance || Date;

    performance.now = performance.now || performance.msNow || performance.mozNow || performance.webkitNow || Date.now;

    lastTime = 0;

    requestAnimationFrame = window.requestAnimationFrame || window.msRequestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.oRequestAnimationFrame || function(callback) {
      var currTime, delay, timeToCall;
      currTime = performance.now();
      timeToCall = Math.max(0, 16 - (currTime - lastTime));
      delay = function() {
        return callback(currTime + timeToCall);
      };
      lastTime = currTime + timeToCall;
      return setTimeout(delay, timeToCall);
    };

    return Timer;

  })();

  Love.Touch = (function() {
    var Finger, getFingerIndex;

    function Touch(eventQueue, canvas) {
      this.getTouchCount = __bind(this.getTouchCount, this);
      this.getTouch = __bind(this.getTouch, this);
      var preventDefault, touchend;
      this.fingers = [];
      preventDefault = function(evt) {
        evt.preventDefault();
        return evt.stopPropagation();
      };
      canvas.addEventListener('gesturestart', preventDefault);
      canvas.addEventListener('gesturechange', preventDefault);
      canvas.addEventListener('gestureend', preventDefault);
      canvas.addEventListener('touchstart', (function(_this) {
        return function(evt) {
          var finger, index, rect, t, _i, _len, _ref, _results;
          preventDefault(evt);
          _ref = evt.targetTouches;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            t = _ref[_i];
            index = getFingerIndex(_this.fingers, t.identifier);
            if (index === -1) {
              rect = Love.element.getBoundingClientRect();
              finger = new Finger(t.identifier, t.pageX - rect.left, t.pageY - rect.top);
              _this.fingers.push(finger);
              _results.push(eventQueue.push('touchpressed', finger.identifier, finger.x, finger.y));
            } else {
              _results.push(void 0);
            }
          }
          return _results;
        };
      })(this));
      touchend = (function(_this) {
        return function(evt) {
          var finger, index, t, _i, _len, _ref, _results;
          preventDefault(evt);
          _ref = evt.changedTouches;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            t = _ref[_i];
            index = getFingerIndex(_this.fingers, t.identifier);
            if (index >= 0) {
              finger = _this.fingers[index];
              _this.fingers.splice(index, 1);
              _results.push(eventQueue.push('touchreleased', finger.identifier, finger.x, finger.y));
            } else {
              _results.push(void 0);
            }
          }
          return _results;
        };
      })(this);
      canvas.addEventListener('touchend', touchend);
      canvas.addEventListener('touchleave', touchend);
      canvas.addEventListener('touchcancel', touchend);
      canvas.addEventListener('touchmove', (function(_this) {
        return function(evt) {
          var finger, index, rect, t, _i, _len, _ref, _results;
          preventDefault(evt);
          _ref = evt.targetTouches;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            t = _ref[_i];
            index = getFingerIndex(_this.fingers, t.identifier);
            if (index >= 0) {
              finger = _this.fingers[index];
              rect = Love.element.getBoundingClientRect();
              finger.x = t.pageX - rect.left;
              finger.y = t.pageY - rect.top;
              _results.push(eventQueue.push('touchmoved', finger.identifier, finger.x, finger.y));
            } else {
              _results.push(void 0);
            }
          }
          return _results;
        };
      })(this));
    }

    Touch.prototype.getTouch = function(id) {
      var finger;
      finger = this.fingers[id];
      if (finger) {
        return [finger.identifier, finger.x, finger.y, 1];
      } else {
        return null;
      }
    };

    Touch.prototype.getTouchCount = function() {
      return Object.keys(this.fingers).length;
    };

    getFingerIndex = function(fingers, id) {
      var finger, index, _i, _ref;
      for (index = _i = 0, _ref = fingers.length; 0 <= _ref ? _i < _ref : _i > _ref; index = 0 <= _ref ? ++_i : --_i) {
        finger = fingers[index];
        if (finger.identifier === id) {
          return index;
        }
      }
      return -1;
    };

    Finger = (function() {
      function Finger(identifier, x, y) {
        this.identifier = identifier;
        this.x = x;
        this.y = y;
      }

      return Finger;

    })();

    return Touch;

  })();

  Love.Window = (function() {
    function Window(graphics) {
      this.graphics = graphics;
      this.setTitle = __bind(this.setTitle, this);
      this.setMode = __bind(this.setMode, this);
      this.setIcon = __bind(this.setIcon, this);
      this.setFullscreen = __bind(this.setFullscreen, this);
      this.isVisible = __bind(this.isVisible, this);
      this.isCreated = __bind(this.isCreated, this);
      this.hasMouseFocus = __bind(this.hasMouseFocus, this);
      this.hasFocus = __bind(this.hasFocus, this);
      this.getWidth = __bind(this.getWidth, this);
      this.getTitle = __bind(this.getTitle, this);
      this.getPixelScale = __bind(this.getPixelScale, this);
      this.getMode = __bind(this.getMode, this);
      this.getIcon = __bind(this.getIcon, this);
      this.getHeight = __bind(this.getHeight, this);
      this.getFullscreenModes = __bind(this.getFullscreenModes, this);
      this.getFullscreen = __bind(this.getFullscreen, this);
      this.getDisplayCount = __bind(this.getDisplayCount, this);
      this.getDimensions = __bind(this.getDimensions, this);
      this.getDesktopDimensions = __bind(this.getDesktopDimensions, this);
      this.fullscreen = false;
    }

    Window.prototype.getDesktopDimensions = function() {
      return [window.screen.width, window.screen.height];
    };

    Window.prototype.getDimensions = function() {
      return [this.getWidth(), this.getHeight()];
    };

    Window.prototype.getDisplayCount = function() {};

    Window.prototype.getFullscreen = function() {
      return this.fullscreen;
    };

    Window.prototype.getFullscreenModes = function() {
      return [];
    };

    Window.prototype.getHeight = function() {
      return this.graphics.getHeight();
    };

    Window.prototype.getIcon = function() {};

    Window.prototype.getMode = function() {};

    Window.prototype.getPixelScale = function() {
      return window.devicePixelRatio;
    };

    Window.prototype.getTitle = function() {
      return window.document.title;
    };

    Window.prototype.getWidth = function() {
      return this.graphics.getWidth();
    };

    Window.prototype.hasFocus = function() {
      return document.activeElement === Love.element;
    };

    Window.prototype.hasMouseFocus = function() {};

    Window.prototype.isCreated = function() {};

    Window.prototype.isVisible = function() {};

    Window.prototype.setFullscreen = function(fullscreen) {
      this.fullscreen = fullscreen;
      return this.fullscreen = false;
    };

    Window.prototype.setIcon = function() {};

    Window.prototype.setMode = function(width, height, flags) {
      return this.graphics.default_canvas.setDimensions(width, height);
    };

    Window.prototype.setTitle = function(title) {
      return window.document.title = title;
    };

    return Window;

  })();

  Love.Audio.Source = (function() {
    function Source(filename, type) {
      this.filename = filename;
      this.type = type;
      this.element = document.createElement("audio");
      this.element.setAttribute("src", Love.root + "/" + filename);
      this.element.setAttribute("preload", "auto");
    }

    Source.prototype.clone = function(self) {
      return new Source(self.filename, self.type);
    };

    Source.prototype.getAttenuationDistances = function(self) {};

    Source.prototype.getChannels = function(self) {};

    Source.prototype.getCone = function(self) {};

    Source.prototype.getDirection = function(self) {};

    Source.prototype.getPitch = function(self) {};

    Source.prototype.getPosition = function(self) {};

    Source.prototype.getRolloff = function(self) {};

    Source.prototype.getVelocity = function(self) {};

    Source.prototype.getVolume = function(self) {
      return self.element.volume;
    };

    Source.prototype.getVolumeLimits = function(self) {};

    Source.prototype.isLooping = function(self) {
      return !!self.element.getAttribute("loop");
    };

    Source.prototype.isPaused = function(self) {
      return self.element.paused;
    };

    Source.prototype.isPlaying = function(self) {
      return !self.element.paused;
    };

    Source.prototype.isRelative = function(self) {};

    Source.prototype.isStatic = function(self) {};

    Source.prototype.isStopped = function(self) {
      return self.isPaused(self) && self.currentTime === 0;
    };

    Source.prototype.pause = function(self) {
      return self.element.pause();
    };

    Source.prototype.play = function(self) {
      return self.element.play();
    };

    Source.prototype.resume = function(self) {
      return self.element.play();
    };

    Source.prototype.rewind = function(self) {
      return self.element.currentTime = 0;
    };

    Source.prototype.seek = function(self, offset, time_unit) {
      if (time_unit == null) {
        time_unit = "seconds";
      }
      switch (time_unit) {
        case "seconds":
          return self.element.currentTime = offset;
      }
    };

    Source.prototype.setAttenuationDistances = function(self) {};

    Source.prototype.setCone = function(self) {};

    Source.prototype.setDirection = function(self) {};

    Source.prototype.setLooping = function(self, looping) {
      return self.element.setAttribute("loop", looping);
    };

    Source.prototype.setPitch = function(self) {};

    Source.prototype.setPosition = function(self) {};

    Source.prototype.setRelative = function(self) {};

    Source.prototype.setRolloff = function(self) {};

    Source.prototype.setVelocity = function(self) {};

    Source.prototype.setVolume = function(self, volume) {
      return self.element.volume = volume;
    };

    Source.prototype.setVolumeLimits = function(self) {};

    Source.prototype.stop = function(self) {
      return self.element.load();
    };

    Source.prototype.tell = function(self, time_unit) {
      if (time_unit == null) {
        time_unit = "seconds";
      }
      switch (time_unit) {
        case "seconds":
          return self.element.currentTime;
        case "samples":
          return 0;
      }
    };

    return Source;

  })();

  Love.Graphics.Canvas2D = (function() {
    Canvas2D.TRANSPARENT = new Love.Color(0, 0, 0, 0);

    function Canvas2D(width, height, element) {
      var canvas_height, canvas_width;
      this.element = element;
      this.getWidth = __bind(this.getWidth, this);
      this.getImageData = __bind(this.getImageData, this);
      this.getHeight = __bind(this.getHeight, this);
      this.getDimensions = __bind(this.getDimensions, this);
      if (this.element == null) {
        this.element = document.createElement('canvas');
      }
      if ((canvas_width = Number(this.element.getAttribute('width'))) !== 0) {
        width = canvas_width;
      }
      if ((canvas_height = Number(this.element.getAttribute('height'))) !== 0) {
        height = canvas_height;
      }
      this.setDimensions(width, height);
      this.context = this.element.getContext('2d');
      this.current_transform = Matrix.I(3);
    }

    Canvas2D.prototype.clear = function(self, r, g, b, a) {
      var color;
      if (r === null || r === void 0) {
        color = this.constructor.TRANSPARENT;
      } else {
        color = new Color(r, g, b, a);
      }
      self.context.save();
      self.context.setTransform(1, 0, 0, 1, 0, 0);
      self.context.fillStyle = color.html_code;
      self.context.globalAlpha = color.a / 255;
      self.context.fillRect(0, 0, self.width, self.height);
      return self.context.restore();
    };

    Canvas2D.prototype.getDimensions = function() {
      return [this.getWidth(), this.getHeight()];
    };

    Canvas2D.prototype.getHeight = function() {
      return this.height;
    };

    Canvas2D.prototype.getImageData = function() {
      var image_data;
      image_data = this.context.getImageData(0, 0, this.width, this.height);
      return new ImageData(image_data);
    };

    Canvas2D.prototype.getPixel = function(self, x, y) {
      var data;
      data = self.context.getImageData(x, y, 1, 1).data;
      return [data[0], data[1], data[2], data[3]];
    };

    Canvas2D.prototype.getWidth = function() {
      return this.width;
    };

    Canvas2D.prototype.getWrap = function(self) {};

    Canvas2D.prototype.setWrap = function(self) {};

    Canvas2D.prototype.arc = function(mode, x, y, radius, startAngle, endAngle, points) {
      var angle_shift, i, phi, _i;
      points || (points = radius > 10 ? radius : 10);
      angle_shift = (endAngle - startAngle) / points;
      phi = startAngle - angle_shift;
      this.context.beginPath();
      this.context.moveTo(x, y);
      for (i = _i = 0; 0 <= points ? _i <= points : _i >= points; i = 0 <= points ? ++_i : --_i) {
        phi += angle_shift;
        this.context.lineTo(x + radius * Math.cos(phi), y + radius * Math.sin(phi));
      }
      this.context.closePath();
      switch (mode) {
        case "fill":
          return this.context.fill();
        case "line":
          return this.context.stroke();
      }
    };

    Canvas2D.prototype.circle = function(mode, x, y, radius, segments) {
      if (radius < 0) {
        return;
      }
      this.context.beginPath();
      this.context.arc(x, y, radius, 0, 2 * Math.PI);
      this.context.closePath();
      switch (mode) {
        case "fill":
          return this.context.fill();
        case "line":
          return this.context.stroke();
      }
    };

    Canvas2D.prototype.draw = function(drawable, quad) {
      switch (true) {
        case !(quad instanceof Love.Graphics.Quad):
          return this.drawDrawable.apply(this, arguments);
        case quad instanceof Love.Graphics.Quad:
          return this.drawWithQuad.apply(this, arguments);
      }
    };

    Canvas2D.prototype.line = function() {
      var i, points, x, y, _i, _ref, _ref1;
      points = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      if (points.length === 1) {
        points = points[0].__shine.numValues.slice(1, points[0].__shine.numValues.length);
      }
      this.context.beginPath();
      this.context.moveTo(points[0], points[1]);
      for (i = _i = 2, _ref = points.length; _i < _ref; i = _i += 2) {
        _ref1 = [points[i], points[i + 1]], x = _ref1[0], y = _ref1[1];
        this.context.lineTo(x, y);
      }
      return this.context.stroke();
    };

    Canvas2D.prototype.point = function(x, y) {
      return this.context.fillRect(x, y, 1, 1);
    };

    Canvas2D.prototype.polygon = function() {
      var i, mode, points, x, y, _i, _ref, _ref1;
      mode = arguments[0], points = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      if (points.length === 1) {
        points = points[0].__shine.numValues.slice(1, points[0].__shine.numValues.length);
      }
      this.context.beginPath();
      this.context.moveTo(points[0], points[1]);
      for (i = _i = 2, _ref = points.length; _i < _ref; i = _i += 2) {
        _ref1 = [points[i], points[i + 1]], x = _ref1[0], y = _ref1[1];
        this.context.lineTo(x, y);
      }
      this.context.closePath();
      switch (mode) {
        case "fill":
          return this.context.fill();
        case "line":
          return this.context.stroke();
      }
    };

    Canvas2D.prototype.print = function(text, x, y) {
      return this.context.fillText(text, x, y);
    };

    Canvas2D.prototype.printf = function(text, x, y, limit, align) {
      if (align == null) {
        align = "left";
      }
      this.context.save();
      this.context.translate(x + limit / 2, y);
      switch (align) {
        case "center":
          this.context.textAlign = "center";
          break;
        case "left":
          this.context.textAlign = "left";
          break;
        case "right":
          this.context.textAlign = "right";
      }
      this.context.fillText(text, 0, 0);
      this.context.restore();
      return this.context.textBaseline = "top";
    };

    Canvas2D.prototype.rectangle = function(mode, x, y, width, height) {
      switch (mode) {
        case "fill":
          return this.context.fillRect(x, y, width, height);
        case "line":
          return this.context.strokeRect(x, y, width, height);
      }
    };

    Canvas2D.prototype.getBackgroundColor = function() {
      var c;
      c = this.background_color;
      return [c.r, c.g, c.b, c.a];
    };

    Canvas2D.prototype.getBlendMode = function() {
      switch (this.context.globalCompositeOperation) {
        case "source-over":
          return "alpha";
        case "multiply":
          return "multiplicative";
        case "lighten":
          return "additive";
      }
    };

    Canvas2D.prototype.getColor = function() {
      var c;
      c = this.current_color;
      return [c.r, c.g, c.b, c.a];
    };

    Canvas2D.prototype.getColorMask = function() {};

    Canvas2D.prototype.getDefaultFilter = function() {};

    Canvas2D.prototype.getFont = function() {
      return this.current_font;
    };

    Canvas2D.prototype.getLineJoin = function() {};

    Canvas2D.prototype.getLineStyle = function() {};

    Canvas2D.prototype.getLineWidth = function() {};

    Canvas2D.prototype.getMaxImageSize = function() {};

    Canvas2D.prototype.getMaxPointSize = function() {};

    Canvas2D.prototype.getPointSize = function() {};

    Canvas2D.prototype.getPointStyle = function() {};

    Canvas2D.prototype.getRendererInfo = function() {};

    Canvas2D.prototype.getScissor = function() {};

    Canvas2D.prototype.getShader = function() {};

    Canvas2D.prototype.getSystemLimit = function() {};

    Canvas2D.prototype.isSupported = function() {};

    Canvas2D.prototype.isWireframe = function() {};

    Canvas2D.prototype.setBackgroundColor = function(r, g, b, a) {
      if (typeof r === "number") {
        return this.background_color = new Color(r, g, b, a);
      } else {
        return this.background_color = new Color(r.getMember(1), r.getMember(2), r.getMember(3), r.getMember(4));
      }
    };

    Canvas2D.prototype.setBlendMode = function(mode) {
      switch (mode) {
        case "alpha":
          return this.context.globalCompositeOperation = "source-over";
        case "multiplicative":
          return this.context.globalCompositeOperation = "multiply";
        case "additive":
          return this.context.globalCompositeOperation = "lighten";
      }
    };

    Canvas2D.prototype.setColor = function(r, g, b, a) {
      if (a == null) {
        a = 255;
      }
      if (typeof r === "number") {
        this.current_color = new Color(r, g, b, a);
      } else {
        this.current_color = new Color(r.getMember(1), r.getMember(2), r.getMember(3), r.getMember(4));
      }
      this.context.fillStyle = this.current_color.html_code;
      this.context.strokeStyle = this.current_color.html_code;
      return this.context.globalAlpha = this.current_color.a / 255;
    };

    Canvas2D.prototype.setFont = function(font) {
      this.current_font = font;
      if (font) {
        return this.context.font = font.html_code;
      } else {
        return this.context.font = this.default_font.html_code;
      }
    };

    Canvas2D.prototype.setColorMask = function() {};

    Canvas2D.prototype.setDefaultFilter = function() {};

    Canvas2D.prototype.setInvertedStencil = function() {};

    Canvas2D.prototype.setLineJoin = function() {};

    Canvas2D.prototype.setLineStyle = function() {};

    Canvas2D.prototype.setLineWidth = function() {};

    Canvas2D.prototype.setPointSize = function() {};

    Canvas2D.prototype.setPointStyle = function() {};

    Canvas2D.prototype.setScissor = function(x, y, width, height) {};

    Canvas2D.prototype.setShader = function() {};

    Canvas2D.prototype.setStencil = function(callback) {};

    Canvas2D.prototype.setWireframe = function() {};

    Canvas2D.prototype.origin = function() {
      return this.context.setTransform(1, 0, 0, 1, 0, 0);
    };

    Canvas2D.prototype.pop = function() {
      return this.context.restore();
    };

    Canvas2D.prototype.push = function() {
      return this.context.save();
    };

    Canvas2D.prototype.rotate = function(r) {
      return this.context.rotate(r);
    };

    Canvas2D.prototype.scale = function(sx, sy) {
      if (sy == null) {
        sy = sx;
      }
      return this.context.scale(sx, sy);
    };

    Canvas2D.prototype.shear = function(kx, ky) {
      return this.context.transform(1, ky, kx, 1, 0, 0);
    };

    Canvas2D.prototype.translate = function(dx, dy) {
      return this.context.translate(dx, dy);
    };

    Canvas2D.prototype.copyContext = function(context) {
      this.context.fillStyle = context.fillStyle;
      this.context.font = context.font;
      this.context.globalAlpha = context.globalAlpha;
      this.context.globalCompositeOperation = context.globalCompositeOperation;
      this.context.lineCap = context.lineCap;
      this.context.lineDashOffset = context.lineDashOffset;
      this.context.lineJoin = context.lineJoin;
      this.context.lineWidth = context.lineWidth;
      this.context.miterLimit = context.miterLimit;
      this.context.shadowBlur = context.shadowBlur;
      this.context.shadowColor = context.shadowColor;
      this.context.shadowOffsetX = context.shadowOffsetX;
      this.context.shadowOffsetY = context.shadowOffsetY;
      this.context.strokeStyle = context.strokeStyle;
      this.context.textAlign = context.textAlign;
      return this.context.textBaseline = context.textBaseline;
    };

    Canvas2D.prototype.setDimensions = function(width, height) {
      this.width = width;
      this.height = height;
      this.element.setAttribute('width', this.width);
      return this.element.setAttribute('height', this.height);
    };

    Canvas2D.prototype.drawDrawable = function(drawable, x, y, r, sx, sy, ox, oy, kx, ky) {
      var halfHeight, halfWidth;
      if (x == null) {
        x = 0;
      }
      if (y == null) {
        y = 0;
      }
      if (r == null) {
        r = 0;
      }
      if (sx == null) {
        sx = 1;
      }
      if (sy == null) {
        sy = sx;
      }
      if (ox == null) {
        ox = 0;
      }
      if (oy == null) {
        oy = 0;
      }
      if (kx == null) {
        kx = 0;
      }
      if (ky == null) {
        ky = 0;
      }
      halfWidth = drawable.element.width / 2;
      halfHeight = drawable.element.height / 2;
      this.context.save();
      this.context.translate(x, y);
      this.context.rotate(r);
      this.context.scale(sx, sy);
      this.context.transform(1, ky, kx, 1, 0, 0);
      this.context.translate(-ox, -oy);
      this.context.drawImage(drawable.element, 0, 0);
      return this.context.restore();
    };

    Canvas2D.prototype.drawWithQuad = function(drawable, quad, x, y, r, sx, sy, ox, oy, kx, ky) {
      var halfHeight, halfWidth;
      if (x == null) {
        x = 0;
      }
      if (y == null) {
        y = 0;
      }
      if (r == null) {
        r = 0;
      }
      if (sx == null) {
        sx = 1;
      }
      if (sy == null) {
        sy = sx;
      }
      if (ox == null) {
        ox = 0;
      }
      if (oy == null) {
        oy = 0;
      }
      if (kx == null) {
        kx = 0;
      }
      if (ky == null) {
        ky = 0;
      }
      halfWidth = drawable.element.width / 2;
      halfHeight = drawable.element.height / 2;
      this.context.save();
      this.context.translate(x, y);
      this.context.rotate(r);
      this.context.scale(sx, sy);
      this.context.transform(1, ky, kx, 1, 0, 0);
      this.context.translate(-ox, -oy);
      this.context.drawImage(drawable.element, quad.x, quad.y, quad.width, quad.height, 0, 0, quad.width, quad.height);
      return this.context.restore();
    };

    return Canvas2D;

  })();

  Love.Graphics.Font = (function() {
    function Font(filename, size) {
      this.filename = filename;
      this.size = size;
      this.html_code = "" + this.size + "px " + this.filename;
    }

    Font.prototype.getAscent = function(self) {};

    Font.prototype.getBaseline = function(self) {};

    Font.prototype.getDescent = function(self) {};

    Font.prototype.getFilter = function(self) {};

    Font.prototype.getHeight = function(self) {};

    Font.prototype.getLineHeight = function(self) {};

    Font.prototype.getWidth = function(self) {};

    Font.prototype.getWrap = function(self) {};

    Font.prototype.hasGlyphs = function(self) {};

    Font.prototype.setFilter = function(self) {};

    Font.prototype.setLineHeight = function(self) {};

    return Font;

  })();

  Love.Graphics.Image = (function() {
    function Image(data) {
      var filename;
      if (data instanceof Love.ImageModule.ImageData) {
        this.element = document.createElement("img");
        this.element.setAttribute("src", data.getString(data));
      } else {
        filename = data;
        this.element = document.getElementById(filename);
        if (this.element === null) {
          this.element = document.createElement("img");
          this.element.setAttribute("src", Love.root + "/" + filename);
        }
      }
    }

    Image.prototype.getData = function(self) {};

    Image.prototype.getDimensions = function(self) {
      return [self.element.width, self.element.height];
    };

    Image.prototype.getFilter = function(self) {};

    Image.prototype.getHeight = function(self) {
      return self.element.height;
    };

    Image.prototype.getMipmapFilter = function(self) {};

    Image.prototype.getWidth = function(self) {
      return self.element.width;
    };

    Image.prototype.getWrap = function(self) {};

    Image.prototype.isCompressed = function(self) {};

    Image.prototype.refresh = function(self) {};

    Image.prototype.setFilter = function(self) {};

    Image.prototype.setMipmapFilter = function(self) {};

    Image.prototype.setWrap = function(self) {};

    return Image;

  })();

  Love.Graphics.Quad = (function() {
    function Quad(x, y, width, height, sw, sh) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.sw = sw;
      this.sh = sh;
    }

    Quad.prototype.getViewport = function(self) {
      return [self.x, self.y, self.width, self.height];
    };

    Quad.prototype.setViewport = function(self, x, y, width, height) {
      self.x = x;
      self.y = y;
      self.width = width;
      return self.height = height;
    };

    return Quad;

  })();

  Love.FileSystem.FileData = (function() {
    function FileData(contents, name, decoder) {
      this.contents = contents;
      this.name = name;
      this.extension = this.name.match("\\.(.*)")[1];
    }

    FileData.prototype.getPointer = function(self) {};

    FileData.prototype.getSize = function(self) {};

    FileData.prototype.getString = function(self) {
      return self.contents;
    };

    FileData.prototype.getExtension = function(self) {
      return self.extension;
    };

    FileData.prototype.getFilename = function(self) {
      return self.name;
    };

    return FileData;

  })();

  Love.ImageModule.ImageData = (function() {
    function ImageData(filedata) {
      this.contents = "data:image/" + (filedata.getExtension(filedata)) + ";base64," + (filedata.getString(filedata));
    }

    ImageData.prototype.getString = function(self) {
      return this.contents;
    };

    ImageData.prototype.encode = function(self) {};

    ImageData.prototype.getDimensions = function(self) {};

    ImageData.prototype.getHeight = function(self) {};

    ImageData.prototype.getPixel = function(self) {};

    ImageData.prototype.getWidth = function(self) {};

    ImageData.prototype.mapPixel = function(self) {};

    ImageData.prototype.paste = function(self) {};

    ImageData.prototype.setPixel = function(self) {};

    return ImageData;

  })();

  Love.Math.BezierCurve = (function() {
    var subdivide;

    function BezierCurve(controlPoints) {
      this.controlPoints = controlPoints;
    }

    BezierCurve.prototype.evaluate = function(self, t) {
      var i, points, step, _i, _j, _ref, _ref1;
      if (t < 0 || t > 1) {
        throw new Love.Exception("Invalid evaluation parameter: must be between 0 and 1");
      }
      if (self.controlPoints.length < 2) {
        throw new Love.Exception("Invalid Bezier curve: Not enough control points.");
      }
      points = self.controlPoints.slice(0);
      for (step = _i = 1, _ref = self.controlPoints.length; 1 <= _ref ? _i < _ref : _i > _ref; step = 1 <= _ref ? ++_i : --_i) {
        for (i = _j = 0, _ref1 = self.controlPoints.length - step; 0 <= _ref1 ? _j < _ref1 : _j > _ref1; i = 0 <= _ref1 ? ++_j : --_j) {
          points[i] = {
            x: points[i].x * (1 - t) + points[i + 1].x * t,
            y: points[i].y * (1 - t) + points[i + 1].y * t
          };
        }
      }
      return [points[0].x, points[0].y];
    };

    BezierCurve.prototype.getControlPoint = function(self, i) {
      if (i < 0) {
        i += self.controlPoints.length;
      }
      if (i < 0 || i >= self.controlPoints.length) {
        throw new Love.Exception("Invalid control point index");
      }
      return [self.controlPoints[i].x, self.controlPoints[i].y];
    };

    BezierCurve.prototype.getControlPointCount = function(self) {
      return self.controlPoints.length;
    };

    BezierCurve.prototype.getDegree = function(self) {
      return self.controlPoints.length - 1;
    };

    BezierCurve.prototype.getDerivative = function(self) {
      var degree, forward_differences, i, _i, _ref;
      if (self.getDegree(self) < 1) {
        throw new Love.Exception("Cannot derive a curve of degree < 1.");
      }
      forward_differences = new Array();
      degree = self.getDegree(self);
      for (i = _i = 0, _ref = self.controlPoints.length - 1; 0 <= _ref ? _i < _ref : _i > _ref; i = 0 <= _ref ? ++_i : --_i) {
        forward_differences.push({
          x: (self.controlPoints[i + 1].x - self.controlPoints[i].x) * degree,
          y: (self.controlPoints[i + 1].y - self.controlPoints[i].y) * degree
        });
      }
      return new self.constructor(forward_differences);
    };

    BezierCurve.prototype.insertControlPoint = function(self, x, y, pos) {
      if (pos == null) {
        pos = -1;
      }
      if (pos < 0) {
        pos += self.controlPoints.length + 1;
      }
      if (pos < 0 || pos > self.controlPoints.length) {
        throw new Love.Exception("Invalid control point index");
      }
      return self.controlPoints.splice(pos, 0, {
        x: x,
        y: y
      });
    };

    BezierCurve.prototype.render = function(self, depth) {
      var results, vertice, vertices, _i, _len;
      if (depth == null) {
        depth = 5;
      }
      if (self.controlPoints.length < 2) {
        throw new Love.Exception("Invalid Bezier curve: Not enough control points.");
      }
      vertices = self.controlPoints.slice(0);
      subdivide(vertices, depth);
      results = [];
      for (_i = 0, _len = vertices.length; _i < _len; _i++) {
        vertice = vertices[_i];
        results.push(vertice.x);
        results.push(vertice.y);
      }
      return results;
    };

    BezierCurve.prototype.rotate = function(self, angle, ox, oy) {
      var c, controlPoint, s, v, _i, _len, _ref, _results;
      if (ox == null) {
        ox = 0;
      }
      if (oy == null) {
        oy = 0;
      }
      c = Math.cos(angle);
      s = Math.sin(angle);
      _ref = self.controlPoints;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        controlPoint = _ref[_i];
        v = {
          x: controlPoint.x - ox,
          y: controlPoint.y - oy
        };
        controlPoint.x = c * v.x - s * v.y + ox;
        _results.push(controlPoint.y = s * v.x + c * v.y + oy);
      }
      return _results;
    };

    BezierCurve.prototype.scale = function(self, s, ox, oy) {
      var controlPoint, _i, _len, _ref, _results;
      if (ox == null) {
        ox = 0;
      }
      if (oy == null) {
        oy = 0;
      }
      _ref = self.controlPoints;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        controlPoint = _ref[_i];
        controlPoint.x = (controlPoint.x - ox) * s + ox;
        _results.push(controlPoint.y = (controlPoint.y - oy) * s + oy);
      }
      return _results;
    };

    BezierCurve.prototype.setControlPoint = function(self, i, x, y) {
      if (i < 0) {
        i += self.controlPoints.length;
      }
      if (i < 0 || i >= self.controlPoints.length) {
        throw new Love.Exception("Invalid control point index");
      }
      return self.controlPoints[i] = {
        x: x,
        y: y
      };
    };

    BezierCurve.prototype.translate = function(self, dx, dy) {
      var controlPoint, _i, _len, _ref, _results;
      _ref = self.controlPoints;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        controlPoint = _ref[_i];
        controlPoint.x += dx;
        _results.push(controlPoint.y += dy);
      }
      return _results;
    };

    subdivide = function(points, k) {
      var i, left, right, step, _i, _j, _k, _l, _ref, _ref1, _ref2, _ref3;
      if (k <= 0) {
        return;
      }
      left = [];
      right = [];
      for (step = _i = 1, _ref = points.length; 1 <= _ref ? _i < _ref : _i > _ref; step = 1 <= _ref ? ++_i : --_i) {
        left.push(points[0]);
        right.push(points[points.length - step]);
        for (i = _j = 0, _ref1 = points.length - step; 0 <= _ref1 ? _j < _ref1 : _j > _ref1; i = 0 <= _ref1 ? ++_j : --_j) {
          points[i] = (points[i] + points[i + 1]) * .5;
        }
      }
      left.push(points[0]);
      right.push(points[0]);
      subdivide(left, k - 1);
      subdivide(right, k - 1);
      for (i = _k = 0, _ref2 = left.length; 0 <= _ref2 ? _k < _ref2 : _k > _ref2; i = 0 <= _ref2 ? ++_k : --_k) {
        points[i] = left[i];
      }
      for (i = _l = 0, _ref3 = right.length; 0 <= _ref3 ? _l < _ref3 : _l > _ref3; i = 0 <= _ref3 ? ++_l : --_l) {
        points[i - 1 + left.length] = right[right.length - i - 1];
      }
      return points;
    };

    return BezierCurve;

  })();

  Love.Math.RandomGenerator = (function() {
    var Long, MAX_VALUE;

    function RandomGenerator() {
      var seed;
      this.last_random_normal = Number.POSITIVE_INFINITY;
      seed = new Long(0xCBBF7A44, 0x0139408D);
      this.setSeed(this, seed);
    }

    RandomGenerator.prototype.rand = function() {
      this.rng_state = this.rng_state.xor(this.rng_state.shiftLeft(13));
      this.rng_state = this.rng_state.xor(this.rng_state.shiftRight(7));
      return this.rng_state = this.rng_state.xor(this.rng_state.shiftLeft(17));
    };

    RandomGenerator.prototype.random = function(self, min, max) {
      if (min === void 0 && max === void 0) {
        return Math.abs(self.rand().toNumber() / MAX_VALUE);
      }
      if (max === void 0) {
        max = min;
        return self.random(self) * max;
      }
      return self.random(self) * (max - min) + min;
    };

    RandomGenerator.prototype.randomNormal = function(self, stddev, mean) {
      var phi, r;
      if (stddev == null) {
        stddev = 1;
      }
      if (mean == null) {
        mean = 0;
      }
      if (self.last_random_normal !== Number.POSITIVE_INFINITY) {
        r = self.last_random_normal;
        self.last_random_normal = Number.POSITIVE_INFINITY;
        return r * stddev + mean;
      }
      r = Math.sqrt(-2.0 * Math.log(1 - self.random(self)));
      phi = 2 * Math.PI * (1 - self.random(self));
      self.last_random_normal = r * Math.cos(phi);
      return r * Math.sin(phi) * stddev + mean;
    };

    RandomGenerator.prototype.setSeed = function(self, low, high) {
      var i, _i, _results;
      if (high) {
        self.seed = new Long(low, high);
      } else {
        self.seed = Long.fromNumber(low);
      }
      self.rng_state = self.seed;
      _results = [];
      for (i = _i = 0; _i <= 2; i = ++_i) {
        _results.push(self.rand());
      }
      return _results;
    };

    RandomGenerator.prototype.getSeed = function(self) {
      return [self.seed.getLowBits(), self.seed.getHighBits()];
    };

    RandomGenerator.prototype.getState = function(self) {
      var high, high_string, low, low_string, padding, ss, _ref;
      _ref = self.getSeed(), low = _ref[0], high = _ref[1];
      padding = '00000000';
      ss = '0x';
      low_string = low.toString(16);
      high_string = high.toString(16);
      ss += padding.substring(0, padding.length - low_string.length) + low_string;
      ss += padding.substring(0, padding.length - high_string.length) + high_string;
      return ss;
    };

    RandomGenerator.prototype.setState = function(self, state_string) {
      var high, low;
      low = parseInt(state_string.substring(2, 10), 16);
      high = parseInt(state_string.substring(10, 18), 16);
      return self.rng_state = new Long(low, high);
    };

    Long = goog.math.Long;

    MAX_VALUE = Long.fromNumber(Number.MAX_VALUE).toNumber();

    return RandomGenerator;

  })();

}).call(this);
