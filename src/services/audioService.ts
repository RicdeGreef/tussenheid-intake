export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async startRecording(): Promise<void> {
    try {
      // Vraag toestemming voor microfoon
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Zoek het beste ondersteunde formaat (Whisper vindt 'audio/webm' prima, mits correct)
      const mimeType = this.getSupportedMimeType();
      console.log("Opnemen met MIME type:", mimeType);

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
      console.log('Opname gestart');
    } catch (error) {
      console.error('Fout bij starten opname:', error);
      throw new Error('Kon microfoon niet starten. Controleer de toestemming.');
    }
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('Geen actieve opname'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        // Maak één grote blob van alle chunks
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        
        // Reset en stop tracks
        this.audioChunks = [];
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
        
        console.log('Opname gestopt. Blob grootte:', audioBlob.size, 'Type:', audioBlob.type);
        
        if (audioBlob.size === 0) {
            reject(new Error("Opname is leeg (0 bytes)."));
            return;
        }

        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  // Hulpfunctie om het beste type te kiezen voor deze browser
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/wav' // Safari soms
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return ''; // Laat de browser de default kiezen
  }
}

export const audioRecorder = new AudioRecorder();