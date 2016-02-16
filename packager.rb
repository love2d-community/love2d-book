require 'pathname'

print <<SNIP
(function () {
    var canvas = document.getElementById('#{ARGV.shift}');
    var Module = {
        arguments: ['./'],
        printErr: console.error.bind(console),
        setStatus: function (e) {
            if (!e && Module.didSyncFS && Module.remainingDependencies === 0)
                Module.callMain(Module.arguments);
        },
        canvas: (function() {
          return canvas;
        })(),
        didSyncFS: false,
        totalDependencies: 0,
        remainingDependencies: 0,
        expectedDataFileDownloads: 1,
        finishedDataFileDownloads: 0,
        monitorRunDependencies: function(left) {
          this.remainingDependencies = left;
          this.totalDependencies = Math.max(this.totalDependencies, left);
        }
    };
    canvas.module = Module;

    function runWithFS () {
SNIP

count = 0
dir = Pathname.new ARGV.shift
Pathname.glob File.join(dir, "**", "*") do |file|
  puts "var fileData#{count+=1} = [];"
  file.binread.unpack('C*').each_slice 10240 do |bytes|
    puts "fileData#{count}.push.apply(fileData#{count}, #{bytes});" #[#{str.bytes.join ","}]);"
  end
  puts "Module['FS_createDataFile']('#{file.dirname.relative_path_from dir}', '#{file.basename}', fileData#{count}, true, true);"
end

=begin
for root, dirs, files in os.walk(sys.argv[2]):
    for name in files:
        data = list(open(os.path.join(root, name), 'rb').read())
        ret += 'var fileData%d = [];\n' % counter
        if data:
            parts = []
            chunk_size = 10240
            start = 0
            while start < len(data):
                parts.append('fileData%d.push.apply(fileData%d, %s);\n' % (counter, counter, str(data[start:start+chunk_size])))
                start += chunk_size
            ret += ''.join(parts)
        ret += "Module['FS_createDataFile']('%s', '%s', fileData%d, true, true);\n" % (os.path.dirname(name), os.path.basename(name), counter)
        counter += 1
=end

print <<SNIP
    }

    if (Module['calledRun']) {
      runWithFS();
    } else {
      if (!Module['preRun']) Module['preRun'] = [];
      Module["preRun"].push(runWithFS); // FS is not initialized yet, wait for it
    }

    window.mod = Module;
})();
SNIP
