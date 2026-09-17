#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef void (^AppInspectorNetworkHandler)(NSDictionary *entry);

/**
 * Observes HTTP(S) traffic of every default/ephemeral NSURLSession created
 * after app load (React Native's included) by prepending itself to the
 * configuration's `protocolClasses`; the host's own session configuration
 * provider is left untouched. Inert until `setEnabled:YES`.
 */
@interface AppInspectorURLProtocol : NSURLProtocol

+ (void)setEnabled:(BOOL)enabled;
+ (void)setCaptureBodies:(BOOL)captureBodies;
+ (void)setMaxBodyBytes:(NSUInteger)maxBodyBytes;
+ (void)setCaptureHeaders:(BOOL)captureHeaders;
+ (void)setEventHandler:(nullable AppInspectorNetworkHandler)handler;

@end

NS_ASSUME_NONNULL_END
