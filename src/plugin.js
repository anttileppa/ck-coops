if (CKEDITOR.coops === undefined) {
  CKEDITOR.coops = {};
}

CKEDITOR.coops.DifferenceAlgorithm = CKEDITOR.tools.createClass({   
  $: function(editor) {
    this._editor = editor;
  },
  proto : {
    getEditor: function () {
      return this._editor;
    }
  }
});

CKEDITOR.coops.Connector = CKEDITOR.tools.createClass({   
  $: function(editor) {
    this._editor = editor;
  },
  proto : {
    getEditor: function() {
      return this._editor;
    }
  }
});

CKEDITOR.coops.RestClient = CKEDITOR.tools.createClass({   
  $: function(serverUrl) {
    this._serverUrl = serverUrl + '/1';
    this._methodOverrideExtension = null;
  },
  proto : {
    setMethodOverrideExtension: function (methodOverrideExtension) {
      this._methodOverrideExtension = methodOverrideExtension;
    },
  
    fileJoin: function (fileId, userId, algorithms, protocolVersion, callback) {
      var parameters = new Array();
      for (var i = 0, l = algorithms.length; i < l; i++) {
        parameters.push({
          name: 'algorithm',
          value: algorithms[i]
        });
      }
      
      parameters.push({
        name: 'protocolVersion',
        value: protocolVersion
      });
    
      var url =  this._serverUrl + '/users/' + userId + '/files/' + fileId + '/join';

      this._doGet(url, parameters, callback);
    },
    
    fileGet: function (fileId, userId, callback) {
      var url =  this._serverUrl + '/users/' + userId + '/files/' + fileId;
      this._doGet(url, {}, callback);
    },
    
    _doGet: function (url, parameters, callback) {
      this._doGetRequest(url, parameters, function (status, responseText) {
        if (!responseText) {
          // Request was probably aborted...
          return;
        }
        
        try {
          if (status != 200) {
            callback(status, null, responseText);
          } else {
            var responseJson = eval("(" + responseText + ")");
            callback(status, responseJson, null);
          }
        } catch (e) {
          callback(status, null, e);
        }
        
      });
    },
    _doPost: function (url, object, callback) {
      this._doJsonPostRequest("post", url, object, callback);
    },
    _doPut: function (url, object, callback) {
      this._doJsonPostRequest("put", url, object, callback);
    },
    _doPatch: function (url, object, callback) {
      this._doJsonPostRequest("patch", url, object, callback);
    },
    _doDelete: function (url, object, callback) {
      this._doJsonPostRequest("delete", url, object, callback);
    },
    _doJsonPostRequest: function (method, url, object, callback) {
      var data = this._toJsonString(object);

      this._doPostRequest(method, url, encodeURIComponent(data), function (status, responseText) {
        if (!responseText) {
          // Request was probably aborted...
          return;
        }
        
        try {
          if (status != 200) {
            callback(status, null, responseText);
          } else {
            var responseJson = eval("(" + responseText + ")");
            callback(status, responseJson, null);
          }
        } catch (e) {
          callback(status, null, e);
        }
      });
    },

    _processParameters: function (parameters) {
      var result = '';
      if ((parameters) && (parameters.length > 0)) {
        for (var i = 0, l = parameters.length; i < l; i++) {
          if (i > 0) {
            result += '&';
          }
          result += encodeURIComponent(parameters[i].name) + '=' + encodeURIComponent(parameters[i].value);  
        }
      }
      
      return result;
    }, 
    
    _doGetRequest: function (url, parameters, callback) {
      var xhr = this._createXMLHttpRequest();
      xhr.open("get", url + ((parameters.length > 0) ? '?' + this._processParameters(parameters) : ''), false);
      xhr.send(null);
      callback(xhr.status, xhr.responseText);
    },
        
    _doPostRequest: function (method, url, data, callback) {
      var xhr = this._createXMLHttpRequest();
      xhr.open("post", url, false);
      xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
      
      if (!CKEDITOR.env.webkit) {
        // WebKit refuses to send these headers as unsafe
        xhr.setRequestHeader("Content-length", data ? data.length : 0);
        xhr.setRequestHeader("Connection", "close");
      }
      
      if (method != 'post') {
        switch (this._methodOverrideExtension) {
          case 'x-http-method-override':
            xhr.setRequestHeader('x-http-method-override', method);
          break;
          default:
            throw new Error("methodOverrideExtension is not set");
          break;
        }
      }
      
      xhr.send(data);
      
      callback(xhr.status, xhr.responseText);
    },
    
    _createXMLHttpRequest: function() {
      if ( !CKEDITOR.env.ie || location.protocol != 'file:' )
      try { return new XMLHttpRequest(); } catch(e) {}
      try { return new ActiveXObject( 'Msxml2.XMLHTTP' ); } catch (e) {}
      try { return new ActiveXObject( 'Microsoft.XMLHTTP' ); } catch (e) {}
      return null;
    }
  }
});

CKEDITOR.coops.CoOps = CKEDITOR.tools.createClass({  
  $: function(editor) {
    this._editor = editor;
    this._lastSelectionRanges = null;

    this._restClient = new CKEDITOR.coops.RestClient(this._editor.config.coops.serverUrl);
    
    // TODO: fileId, userId begone!
    // TODO: extensions into extension plugins
    this._joinFile(this._editor.config.coops.fileId, this._editor.config.coops.userId, ['dmp'], '1.0.0draft1');
  },
  proto : {
    getEditor: function () {
      return this._editor;
    },
  
    _joinFile: function (fileId, userId, algorithms, protocolVersion) {
      var _this = this;
      this._restClient.fileJoin(fileId, userId, algorithms, protocolVersion, function (status, responseJson, error) {
        _this._loadFile(responseJson.response);
      });
    },
    _loadFile: function (joinData) {
      var session = joinData.session;

      var _this = this;
      this._restClient.fileGet(session.fileId, session.userId, function (status, responseJson, error) {
        _this._startSession(joinData, responseJson.response.file.content, responseJson.response.file.revisionNumber);
      });
    },
    _startSession: function(joinData, content, revisionNumber) {
      // TODO: setData vs setHtml?
      // this._editor.setData(content);
      
      this.getEditor().getChangeObserver().pause();
      try {
        this.getEditor().getSelection().removeAllRanges();
        this.getEditor().setData(content);
      } finally {
        this.getEditor().getChangeObserver().reset();
        this.getEditor().getChangeObserver().resume();
      }
      
      var extensions = joinData.extensions;
     
      if (extensions.indexOf('x-http-method-override') > -1) {
        this._restClient.setMethodOverrideExtension('x-http-method-override');
      } else {
        // Proper error handling
        throw new Error('Server does not support x-http-method-override extension, which is required by this plugin');
      }
      
      this.getEditor().fire("CoOPS:SessionStart", {
        joinData: joinData,
        content: content, 
        revisionNumber: revisionNumber
      });
      
      this.getEditor().on('selectionCheck', this._onSelectionCheck, this);
    },
    _onSelectionCheck: function (event) {
      var selection = this.getEditor().getSelection();
      var ranges = selection.getRanges(); 
      var changed = true;
      
      if (this._lastSelectionRanges != null) {
        var rangesLength = ranges.length;
        if (this._lastSelectionRanges.length == rangesLength) {
          changed = false;
        
          for (var i = 0; i < rangesLength; i++) {
            var range = ranges[i];
            var lastRange = this._lastSelectionRanges[i];
            
            if ((range.startOffset != lastRange.startOffset)||
              (range.endOffset != lastRange.endOffset)||
              (!range.startContainer.equals(lastRange.startContainer))||
              (!range.endContainer.equals(lastRange.endContainer))
            ) {
              changed = true; 
              break;
            }
          }
        }
      } 
    
      if (changed == true) {
        var selectionRanges = new Array();
        for (var i = 0, l = ranges.length; i < l; i++) {
          selectionRanges.push(ranges[i].clone());
        }
        
        this.getEditor().fire('CoOPS:SelectionChange', {
          ranges: selectionRanges
        });
        
        this._lastSelectionRanges = selectionRanges;
      }
    }
  }
});

CKEDITOR.plugins.add( 'coops', {
  requires: ['change'],
  init: function( editor ) {  
    editor.on( 'instanceReady', function(event) {
      editor._coOps = new CKEDITOR.coops.CoOps(editor);
    });
  }
});