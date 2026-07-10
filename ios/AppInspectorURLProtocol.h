#import <Foundation/Foundation.h>

typedef void (^AppInspectorNetworkHandler)(NSDictionary *entry);

/**
 * Observes HTTP(S) traffic in React Native's NSURLSession (and, while capture
 * is on, the shared session). Inert until `setEnabled:YES`.
 */
@interface AppInspectorURLProtocol : NSURLProtocol

+ (void)setEnabled:(BOOL)enabled;
+ (void)setEventHandler:(nullable AppInspectorNetworkHandler)handler;

@end
