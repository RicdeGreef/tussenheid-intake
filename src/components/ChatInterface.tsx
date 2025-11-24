import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Phone } from "lucide-react";
import { ChatMessage, Message } from "./ChatMessage";
import { MicrophoneButton, MicrophoneState } from "./MicrophoneButton";
import { audioRecorder } from "@/services/audioService";
// Aangepaste imports voor de nieuwe backend logica
import { 
  processAudioIntake, 
  playAudioResponse, 
  ExtractedData 
} from "@/services/apiService";
import { toast } from "@/hooks/use-toast";

interface ChatInterfaceProps {
  onBack: () => void;
}

export const ChatInterface = ({ onBack }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [micState, setMicState] = useState<MicrophoneState>('idle');
  
  // We houden nu 'extractedData' bij. Dit is de kennis die de AI verzamelt.
  const [extractedData, setExtractedData] = useState<ExtractedData>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Initiële begroeting
  useEffect(() => {
    const welcomeMessage: Message = {
      id: '1',
      role: 'assistant',
      content: "Goedemorgen! Wat fijn dat u interesse heeft in Tussenheid. Ik ben uw digitale assistent. Mag ik beginnen met uw naam?",
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);
  }, []);
  
  const handleToggleRecording = async () => {
    if (micState === 'recording') {
      // 1. Stop opname en zet status op 'verwerken'
      setMicState('processing');
      
      try {
        const audioBlob = await audioRecorder.stopRecording();
        
        // 2. Eén call naar de backend (stuurt audio + wat we al weten)
        // Dit vervangt de losse transcribe/generate/tts stappen
        const result = await processAudioIntake(audioBlob, extractedData);
        
        // 3. Voeg bericht van gebruiker toe (wat Whisper hoorde)
        const userMessage: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: result.userText,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, userMessage]);
        
        // 4. Update de kennis die we hebben over de gebruiker
        // De AI stuurt de geüpdatete JSON terug
        if (result.extractedData) {
            setExtractedData(result.extractedData);
            console.log("Huidige verzamelde data:", result.extractedData);
        }
        
        // 5. Zet status op 'spreken' (zodat de gebruiker ziet dat de bot praat)
        setMicState('speaking');
        
        // 6. Voeg antwoord van de bot toe (tekst)
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: result.botText,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMessage]);
        
        // 7. Speel de audio af (wacht tot het klaar is)
        await playAudioResponse(result.audioBase64);
        
        // 8. Klaar!
        setMicState('idle');

        // Optioneel: Als het gesprek klaar is, geef feedback
        if (result.isFinished) {
            toast({
                title: "Intake afgerond",
                description: "Bedankt! We hebben uw gegevens ontvangen en gaan op zoek naar een match.",
                duration: 5000,
            });
        }
        
      } catch (error) {
        console.error('Error processing audio:', error);
  toast({
    title: "Foutmelding",
    // Hierdoor zie je wat de server teruggeeft (bijv. "Server Error 500: ...")
    description: error.message || "Er ging iets mis.", 
    variant: "destructive",
  });
  setMicState('idle');
      }
      
    } else {
      // Start opname
      try {
        await audioRecorder.startRecording();
        setMicState('recording');
      } catch (error) {
        console.error('Error starting recording:', error);
        toast({
          title: "Microfoon Fout",
          description: "Kon microfoon niet starten. Controleer of u toestemming heeft gegeven.",
          variant: "destructive",
        });
      }
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-accent/20">
      <Card className="max-w-3xl w-full h-[85vh] flex flex-col shadow-[var(--shadow-card)]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-secondary/30">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onBack}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Terug
          </Button>
          
          <h2 className="text-lg font-semibold">Intake Gesprek</h2>
          
          <Button 
            variant="ghost" 
            size="sm"
            className="gap-2"
            asChild
          >
            <a href="tel:+31201234567">
              <Phone className="w-4 h-4" />
              <span className="hidden sm:inline">Bel ons</span>
            </a>
          </Button>
        </div>
        
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Microphone Control */}
        <div className="p-6 border-t bg-secondary/20">
          <div className="flex justify-center">
            <MicrophoneButton 
              state={micState}
              onToggleRecording={handleToggleRecording}
            />
          </div>
          
          {/* Fallback help */}
          <div className="text-center mt-6 pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">
              Lukt het niet via spraak?
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href="tel:+31201234567">
                Bel voor persoonlijk contact
              </a>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};