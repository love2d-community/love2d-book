#!/usr/bin/env ruby

require 'bundler/setup'
require 'rubygems' if RUBY_VERSION < '1.9'

require 'asciidoctor-pdf'
require 'asciidoctor'
require 'asciidoctor/extensions'

Asciidoctor::Extensions.register do
  block do
    named :livecode
    on_context :pass
    parse_content_as :raw
    name_positional_attributes 'name'

    process do |parent, reader, attrs|
      res = ""
      preload = ( attrs.delete('preload') || '').split(',')
      name    = attrs.delete('name')
      res = %(
<div class="preload">#{(preload.map do |n| %(<img src="assets/#{name+"/"+n}" />) end).join("\n")}</div>
<canvas id="#{name}-canvas"></canvas>)
      if attrs.has_key? 'multi' then
        names = []
        reader.read.split("###").each do |t|
          spl = t.split("\n")
          next if spl == []
          file = %(tmp/#{spl[0]})
          names << file
          File.open(file, 'w') do |f|
            f.write( spl.drop(1).join("\n") )
          end
        end
        game_json = %x{node_modules/.bin/moonshine distil #{names.join(' ')}}
        res  = res + %(<script>new Punchdrunk({ "game_code": #{game_json}, "canvas": document.getElementById("#{name}-canvas") });</script>)
      else
        File.open('tmp/file.lua', 'w') do |f|
          f.write( reader.read )
        end
        game_json = %x{node_modules/.bin/moonshine distil tmp/file.lua}
        res  = res + %(<script>new Punchdrunk({ "game_code": #{game_json}, "canvas": document.getElementById("#{name}-canvas") });</script>)
      end
      create_pass_block parent, %(<div class="livecode">#{res}</div>), attrs
    end
  end

  block_macro do
    named :livecode

    parse_content_as :raw

    process do |parent, target, attrs|
      res = ""
      preload = ( attrs.delete('preload') || '').split(',')
      name = attrs.delete( 'name' ) || target
      res = %(
<div class="preload">#{(preload.map do |n| %(<img src="assets/#{target+"/"+n}" />) end).join("\n")}</div>
<canvas id="#{name}-canvas"></canvas>)
      game_json = %x{node_modules/.bin/moonshine distil -p book/code/#{target}}
      res  = res + %(<script>new Punchdrunk({ "game_code": #{game_json}, "canvas": document.getElementById("#{name}-canvas") });</script>)
      create_pass_block parent, %(<div class="livecode">#{res}</div>), attrs
    end
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
