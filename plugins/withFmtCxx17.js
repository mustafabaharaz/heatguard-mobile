// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · Expo config plugin: compile the `fmt` pod as C++17
//
// Why: React Native 0.76 (Expo SDK 52) bundles fmt 9.x. Xcode 26's clang
// rejects fmt's consteval format strings under C++20 ("call to consteval
// function ... is not a constant expression"). Building just that pod as
// C++17 sidesteps it. Applied on every prebuild, so it survives `rm -rf ios`
// and works in EAS cloud builds. Safe to delete after upgrading Expo.
//
// Must run AFTER react_native_post_install(...), which forces every pod
// target to C++20 and would otherwise undo this.
// ─────────────────────────────────────────────────────────────────────────────

const { withPodfile } = require('expo/config-plugins');

const MARKER = '# HeatGuard: fmt C++17 fix';

const SNIPPET = `
    ${MARKER} (Xcode 26 clang vs fmt 9 consteval)
    installer.pods_project.targets.each do |t|
      if t.name == 'fmt'
        t.build_configurations.each do |c|
          c.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        end
      end
    end
`;

module.exports = function withFmtCxx17(config) {
  return withPodfile(config, cfg => {
    const contents = cfg.modResults.contents;
    if (contents.includes(MARKER)) return cfg;

    // Insert right after the react_native_post_install( ... ) call
    const rnCall = /react_native_post_install\([\s\S]*?\n\s*\)\n/;
    if (!rnCall.test(contents)) {
      throw new Error('[withFmtCxx17] Could not find react_native_post_install(...) in Podfile');
    }
    cfg.modResults.contents = contents.replace(rnCall, match => match + SNIPPET);
    return cfg;
  });
};
