require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-app-inspector"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "13.4" }
  s.source       = { :git => "https://github.com/phaelor/react-native-app-inspector.git", :tag => "v#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm}"

  # Pulls in React-Core and, on the new architecture, the codegen/Fabric deps.
  install_modules_dependencies(s)
end
