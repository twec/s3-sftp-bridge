var Promise = require('bluebird'),
    SshClient = require('ssh2').Client;
exports.DoneDir = '.done';

// Returns a Disposer
exports.getSshClient = function(config) {
  var conn = new SshClient();
  var promise = new Promise(function(resolve, reject) {
    conn
    .on('ready', function() {
      resolve(conn);
    })
    .on('error', function(e) {
      reject(e);
     })
    .connect(config);
  });
  return promise.disposer(function(conn, promise) {
    conn.end();
  });
}

/*
sftp: SFTP client from ssh2, assumed to already be promisified.
dir: The directory where the file lives.
fileName: The file to be written, should not include any of the directory path. Can
  optionally be the file's info (from readdir), for efficiency.
process: A function with one argument, the body of the file as a Buffer.
*/
exports.processFile = function(sftp, dir, fileName, process) {
  return Promise.try(function() {
    if (fileName.filename) {
      return fileName
    } else {
      return sftp.readdirAsync(dir)
      .then(function(dirList) {
        return dirList.find(function(item) { return item.filename == fileName})
      });
    }
  })
  .then(function(fileInfo) {
      return sftp.createReadStream(dir + '/' + fileInfo.filename)
  })
      .then(function(data) {
        return process(result);
      })
      .then(function(data) {
        return sftp.readdirAsync(dir)
        .then(function(dirList) {
          if (!dirList.find(function(item) { return item.filename == exports.DoneDir})) return sftp.mkdirAsync(dir + '/' + exports.DoneDir);
        })
        .then(function() {
          return sftp.renameAsync(dir + '/' + fileInfo.filename, dir + '/' + exports.DoneDir + '/' + getCurrentTimestamp() + '-' + fileInfo.filename);
        })
        .then(function() {
          return data;
        })
      });
}

// Don't attempt to use the sftp object outside of the 'process' function (i.e.
// in a .then hung off the resultant Promise) - the connection will be closed.
exports.withSftpClient = function(config, process) {
  return Promise.using(exports.getSshClient(config), function(conn) {
    return Promise.promisify(conn.sftp, {context: conn})()
      .then(function(sftp) {
        return process(Promise.promisifyAll(sftp));
    });
  });
}

/*
sftp: SFTP client from ssh2
fileName: The full path of the file to be written
readStream: A stream containing the body to write to the file. UTF-8.
*/
exports.writeFile = function(conn, fileName, readStream) {
  var promise = new Promise(function(resolve, reject){
    var handleError = function(err){
      reject(err);
    }
    try {
      conn.sftp(function(err, sftp){
        if (err){
          reject(err);
        }
        var writeStream = sftp.createWriteStream(fileName);
        readStream.pipe(writeStream);
      });
    } catch (err){
      reject(err);
    }
    readStream.on('error', handleError);
    writeStream.on('error', handleError);
    writeStream.on('finish', function(){
      resolve(writeStream);
    });
  });
  return promise;
}

function getCurrentTimestamp() {
  return (new Date()).toISOString().slice(0,19).replace(/-/g,"").replace(/:/g,"").replace(/T/g,"");
}
