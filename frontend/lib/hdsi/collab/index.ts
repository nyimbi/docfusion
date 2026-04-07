/**
 * HDSI Collaboration Submodule
 *
 * Real-time collaboration, speech input, voice commands,
 * and eye tracking.
 *
 * Dependency graph:
 *   collaboration   -> core/types, core/db
 *   speech-to-text  -> (none)
 *   voice           -> core/types
 *   eye-tracking    -> (none)
 */

// Yjs/WebRTC real-time collaboration
export {
  collaborationManager,
  useCollaboration,
} from "../collaboration";

// Speech-to-text input for all editable fields
export {
  useSpeechToText,
  useSpeechInput,
  getListeningIndicatorState,
  createAriaLabelForSpeechButton,
  DEFAULT_SPEECH_COMMANDS,
  SUPPORTED_LANGUAGES,
  type SpeechResult,
  type SpeechCommand,
  type SpeechState,
} from "../speech-to-text";

// Voice command interface
export {
  parseVoiceCommand,
  VoiceManager,
  executeVoiceCommand,
  useVoiceInterface,
} from "../voice";

// Eye tracking integration
export {
  EyeTrackingManager,
  useEyeTracking,
  useFocusAware,
} from "../eye-tracking";
