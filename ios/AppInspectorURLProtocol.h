#import <Foundation/Foundation.h>

typedef void (^AppInspectorNetworkHandler)(NSDictionary *entry);

/**
 * Observes HTTP(S) traffic of every default/ephemeral NSURLSession created
 * after app load (React Native's included) by prepending itself to the
 * configuration's `protocolClasses`; the host's own session configuration
 * provider is left untouched. Inert until `setEnabled:YES`.
 */
@interface AppInspectorURLProtocol : NSURLProtocol

+ (void)setEnabled:(BOOL)enabled;
+ (void)setEventHandler:(nullable AppInspectorNetworkHandler)handler;

@end
