#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <RNAppInspectorSpec/RNAppInspectorSpec.h>
#endif

@interface AppInspector : RCTEventEmitter <RCTBridgeModule
#ifdef RCT_NEW_ARCH_ENABLED
                                            , NativeAppInspectorSpec
#endif
                                            >
@end
