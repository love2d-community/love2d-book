#!/usr/bin/env ruby

require 'bundler/setup'
require 'rubygems' if RUBY_VERSION < '1.9'

require 'pathname'
require 'asciidoctor'
require 'asciidoctor/extensions'

def byteify files
  count = 0
  res = ""
  files.each do |(path, file)|
    res += "var fileData#{count+=1} = [];\n"
    file.unpack('C*').each_slice 10240 do |bytes|
      res += "fileData#{count}.push.apply(fileData#{count}, #{bytes});\n"
    end
    res += "Module['FS_createDataFile']('#{path.dirname}', '#{path.basename}', fileData#{count}, true, true);"
  end
  res
end

def package name, files
  <<EOF
(function () {
    var canvas = document.getElementById('#{name}-canvas');
    var Module = {
        arguments: ['./'],
        printErr: console.error.bind(console),
        setStatus: function (e) {
            if (!e && Module.didSyncFS && Module.remainingDependencies === 0)
                Module.callMain(Module.arguments);
        },
        canvas: canvas,
        didSyncFS: false,
        totalDependencies: 0,
        remainingDependencies: 0,
        expectedDataFileDownloads: 1,
        finishedDataFileDownloads: 0,
        monitorRunDependencies: function(left) {
          this.remainingDependencies = left;
          this.totalDependencies = Math.max(this.totalDependencies, left);
        },
        preRun: [function(){ Module.ENV.SDL_EMSCRIPTEN_KEYBOARD_ELEMENT = "#canvas"; }]
    };
    canvas.module = Module;

    function runWithFS () {
      #{byteify(files)}
    }

    if (Module['calledRun']) {
      runWithFS();
    } else {
      if (!Module['preRun']) Module['preRun'] = [];
      Module["preRun"].push(runWithFS); // FS is not initialized yet, wait for it
    }

    window.mod = Module;
})();
EOF
end

class LoveWikiMacro < Asciidoctor::Extensions::InlineMacroProcessor
  use_dsl
  named :wiki

  name_positional_attributes 'alt'

  def process parent, target, attrs
    text = Asciidoctor::Inline.new parent, :quoted, (attrs['alt'] or target), {type: :monospaced}
    target = "https://love2d.org/wiki/#{target}"
    (create_anchor parent, text.render, type: :link, target: target).render
  end
end

Asciidoctor::Extensions.register do
  block do
    named :livecode
    on_context :pass
    parse_content_as :raw
    name_positional_attributes 'name'

    process do |parent, reader, attrs|
      name = attrs.delete('name')
      files = []
      if attrs.has_key? 'multi' then
        reader.read.split("###").each do |t|
          spl = t.split("\n")
          next if spl == []
          files << [Pathname.new(spl[0]), spl.drop(1).join("\n")]
        end
      else
        files << [Pathname.new("main.lua"), reader.read]
      end
      create_pass_block parent, %(<div class="livecode">
        <canvas id="#{name}-canvas" data-module="#{name}"></canvas>
        <script>#{package name, files}</script>
      </div>), attrs
    end
  end

  block_macro do
    named :livecode

    parse_content_as :raw

    process do |parent, target, attrs|
      name = attrs.delete('name') || target

      target = Pathname.new File.join "book", "code", target
      files = Pathname.glob(File.join(target, "**", "*")).collect { |file| [file.relative_path_from(target), file.binread] }

      create_pass_block parent, %(<div class="livecode">
        <canvas id="#{name}-canvas" data-module="#{name}"></canvas>
        <script>#{package name, files}</script>
      </div>), attrs
    end
  end

  block_macro do
    named :code_example

    parse_content_as :raw

    process do |parent, target, attrs|
      code_dir = File.join(parent.document.base_dir, 'code', target)

      exclude = (attrs.delete('exclude') || 'lib/*').split(',')
      include = (attrs.delete('include') || '**/*.lua').split(',')

      include.map! {|pat| Dir.glob(File.join(code_dir, pat)) }
      exclude.map! {|pat| Dir.glob(File.join(code_dir, pat)) }

      res = create_open_block parent, "", attrs, content_model: :compound
      attrs['language'] ||= 'lua'
      (include.inject(&:+) - exclude.inject(&:+)).each do |file|
        block = create_listing_block res, File.read(file), attrs, subs: [:highlight, :callouts]
        block.style = "source"
        block.title = File.basename(file)
        res << block
      end
      res
    end
  end

  include_processor do
    process do |doc, reader, target, attributes|
      reader.push_include File.read(File.join(doc.base_dir, 'code', target)), target, target, 1, attributes
      reader
    end

    def handles? target
      target =~ %r(world[1-3]/.*/)
    end
  end

  inline_macro LoveWikiMacro
end

if __FILE__ == $0
  require 'asciidoctor/cli'

  ARGV << "-T"
  ARGV << "templates"
  invoker = Asciidoctor::Cli::Invoker.new ARGV
  GC.start
  invoker.invoke!
  exit invoker.code
end
