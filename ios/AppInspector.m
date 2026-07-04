#import "AppInspector.h"

#import <QuartzCore/CADisplayLink.h>
#import <mach/mach.h>
#import <sys/sysctl.h>

@implementation AppInspector {
  CADisplayLink *_displayLink;
  NSTimer *_emitTimer;
  NSInteger _frameCount;
  CFTimeInterval _windowStart;
  double _uiFps;
  BOOL _hasListeners;
  CADisplayLink *_frameWatchLink;
  NSMutableArray *_frameWatchResolvers;
}

RCT_EXPORT_MODULE(AppInspector)

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

- (NSArray<NSString *> *)supportedEvents {
  return @[ @"AppInspectorMetrics" ];
}

- (void)startObserving {
  _hasListeners = YES;
}

- (void)stopObserving {
  _hasListeners = NO;
}

RCT_EXPORT_METHOD(startMonitoring : (double)intervalMs) {
  dispatch_async(dispatch_get_main_queue(), ^{
    [self stopInternal];
    self->_frameCount = 0;
    self->_uiFps = 0;
    self->_windowStart = CACurrentMediaTime();
    self->_displayLink =
        [CADisplayLink displayLinkWithTarget:self selector:@selector(onFrame:)];
    [self->_displayLink addToRunLoop:[NSRunLoop mainRunLoop]
                             forMode:NSRunLoopCommonModes];
    self->_emitTimer =
        [NSTimer scheduledTimerWithTimeInterval:(intervalMs / 1000.0)
                                         target:self
                                       selector:@selector(emit)
                                       userInfo:nil
                                        repeats:YES];
  });
}

RCT_EXPORT_METHOD(stopMonitoring) {
  dispatch_async(dispatch_get_main_queue(), ^{
    [self stopInternal];
  });
}

- (void)stopInternal {
  [_displayLink invalidate];
  _displayLink = nil;
  [_emitTimer invalidate];
  _emitTimer = nil;
}

- (void)onFrame:(CADisplayLink *)link {
  _frameCount += 1;
  CFTimeInterval elapsed = link.timestamp - _windowStart;
  if (elapsed >= 1.0) {
    _uiFps = _frameCount / elapsed;
    _frameCount = 0;
    _windowStart = link.timestamp;
  }
}

- (void)emit {
  if (!_hasListeners) {
    return;
  }
  [self sendEventWithName:@"AppInspectorMetrics"
                     body:@{
                       @"uiFps" : @(round(_uiFps)),
                       @"usedMemoryMb" : @([self usedMemoryMb]),
                       @"cpuPercent" : @([self cpuPercent]),
                     }];
}

// Sum the per-thread CPU usage of this process (percentage of one core; can
// exceed 100% across multiple busy threads).
- (double)cpuPercent {
  thread_act_array_t threads;
  mach_msg_type_number_t threadCount = 0;
  if (task_threads(mach_task_self(), &threads, &threadCount) != KERN_SUCCESS) {
    return 0;
  }
  double total = 0;
  for (mach_msg_type_number_t i = 0; i < threadCount; i++) {
    thread_basic_info_data_t info;
    mach_msg_type_number_t infoCount = THREAD_BASIC_INFO_COUNT;
    if (thread_info(threads[i], THREAD_BASIC_INFO, (thread_info_t)&info,
                    &infoCount) == KERN_SUCCESS &&
        !(info.flags & TH_FLAGS_IDLE)) {
      total += info.cpu_usage / (double)TH_USAGE_SCALE * 100.0;
    }
  }
  vm_deallocate(mach_task_self(), (vm_offset_t)threads,
                threadCount * sizeof(thread_act_t));
  return round(total * 10.0) / 10.0;
}

- (double)usedMemoryMb {
  task_vm_info_data_t info;
  mach_msg_type_number_t count = TASK_VM_INFO_COUNT;
  kern_return_t kr = task_info(mach_task_self(), TASK_VM_INFO,
                               (task_info_t)&info, &count);
  if (kr != KERN_SUCCESS) {
    return 0;
  }
  double mb = (double)info.phys_footprint / (1024.0 * 1024.0);
  return round(mb * 10.0) / 10.0;
}

// Presentation time (ms, CACurrentMediaTime clock — same clock as RN touch
// timestamps) of the next frame.
RCT_EXPORT_METHOD(watchNextFrame : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    if (!self->_frameWatchResolvers) {
      self->_frameWatchResolvers = [NSMutableArray new];
    }
    [self->_frameWatchResolvers addObject:resolve];
    if (!self->_frameWatchLink) {
      self->_frameWatchLink =
          [CADisplayLink displayLinkWithTarget:self
                                      selector:@selector(onWatchedFrame:)];
      [self->_frameWatchLink addToRunLoop:[NSRunLoop mainRunLoop]
                                  forMode:NSRunLoopCommonModes];
    }
  });
}

- (void)onWatchedFrame:(CADisplayLink *)link {
  double presentedMs = link.targetTimestamp * 1000.0;
  NSArray *pending = [_frameWatchResolvers copy];
  [_frameWatchResolvers removeAllObjects];
  [_frameWatchLink invalidate];
  _frameWatchLink = nil;
  for (RCTPromiseResolveBlock resolve in pending) {
    resolve(@(presentedMs));
  }
}

RCT_EXPORT_METHOD(getProcessStartTime : (RCTPromiseResolveBlock)resolve
                  rejecter : (RCTPromiseRejectBlock)reject) {
  struct kinfo_proc proc;
  size_t length = sizeof(proc);
  int mib[4] = {CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()};
  if (sysctl(mib, 4, &proc, &length, NULL, 0) == 0) {
    struct timeval start = proc.kp_proc.p_starttime;
    double epochMs = start.tv_sec * 1000.0 + start.tv_usec / 1000.0;
    resolve(@(epochMs));
  } else {
    resolve(@(0));
  }
}

@end
