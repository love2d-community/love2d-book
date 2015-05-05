Bundler.require(:default)
$:.unshift "."
require 'lovedoctor'

module ::Guard
  class LoveDoctor < Plugin
    def run_all
      puts "rendering html.adoc"
      Asciidoctor.convert_file 'book/html.adoc', base_dir: 'book', to_file: '../public/index.html', safe: :unsafe, template_dir: 'templates'
    end

    def run_on_modifications(paths)
      puts "rendering html.adoc"
      Asciidoctor.convert_file 'book/html.adoc', base_dir: 'book', to_file: '../public/index.html', safe: :unsafe, template_dir: 'templates'
    end
  end
end

guard :lovedoctor do
  watch(%r{^.*\.adoc$})
  watch(%r{^templates/.*$})
end

guard :livereload do
  watch('public/index.html')
end
