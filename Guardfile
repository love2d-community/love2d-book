Bundler.require(:default)
$:.unshift "."
require 'lovedoctor'

module ::Guard
  class LoveDoctor < Plugin
    def run_all
      Asciidoctor.convert_file 'book/html.adoc', base_dir: 'book', to_file: '../public/index.html', safe: :unsafe
    end

    def run_on_modifications(paths)
      Asciidoctor.convert_file 'book/html.adoc', base_dir: 'book', to_file: '../public/index.html', safe: :unsafe
    end
  end
end

guard :lovedoctor do
  watch(%r{^.*\.adoc$})
end

guard :livereload do
  watch('public/index.html')
end
