package app.opengolf.feedback

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.SoundPool
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// The ball-in-cup sound on Android (#611 §15 native phase). expo-audio isn't
// used here: its manifest merges RECORD_AUDIO and a microphone foreground
// service into the app. The media stream also ignores the ringer, so the
// sound plays only when the ringer mode is NORMAL (silent / vibrate = quiet).
// SoundPool never requests audio focus, so the player's music keeps playing.
class OgaFeedbackModule : Module() {
  private var pool: SoundPool? = null
  private var cupId = 0
  private var loaded = false

  override fun definition() = ModuleDefinition {
    Name("OgaFeedback")

    OnCreate {
      val ctx = appContext.reactContext ?: return@OnCreate
      val p = SoundPool.Builder()
        .setMaxStreams(1)
        .setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        )
        .build()
      p.setOnLoadCompleteListener { _, _, status -> loaded = status == 0 }
      cupId = p.load(ctx, R.raw.oga_cup, 1)
      pool = p
    }

    OnDestroy {
      pool?.release()
      pool = null
    }

    // Returns whether it played.
    Function("playCup") { volume: Double ->
      val ctx = appContext.reactContext ?: return@Function false
      val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      if (am.ringerMode != AudioManager.RINGER_MODE_NORMAL || !loaded) return@Function false
      val v = volume.toFloat()
      pool?.play(cupId, v, v, 1, 0, 1f)
      return@Function true
    }
  }
}
