import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Phone, Send } from "lucide-react";
import { ChatMessage, Message } from "./ChatMessage";
import { MicrophoneButton, MicrophoneState } from "./MicrophoneButton";
import { audioRecorder } from "@/services/audioService";
import {
  processIntake,
  playAudioResponse,
  ExtractedData,
} from "@/services/apiService";
import { toast } from "@/hooks/use-toast";

interface ChatInterfaceProps {
  onBack: () => void;
}

export const ChatInterface = ({ onBack }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [micState, setMicState] = useState<MicrophoneState>("idle");
  const [extractedData, setExtractedData] = useState<ExtractedData>({});
  const [inputText, setInputText] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const welcomeMessage: Message = {
      id: "1",
      role: "assistant",
      content:
        "Goedemorgen! Wat fijn dat u interesse heeft in Tussenheid. Ik ben uw digitale assistent en samen gaan wij uw profiel compleet maken! Mag ik beginnen met uw naam?",
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  }, []);

  // Algemene functie om input (audio of tekst) te verwerken
  const handleProcessInput = async (input: Blob | string) => {
    setMicState("processing");

    try {
      // ✅ Stuur ALTIJD de huidige extractedData mee naar de backend
      const result = await processIntake(input, extractedData);

      // Gebruiker bericht tonen (als het tekst was, hebben we die al, bij audio komt die terug)
      if (input instanceof Blob) {
        const userMessage: Message = {
          id: Date.now().toString(),
          role: "user",
          content: result.userText,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMessage]);
      }

      // ✅ NIEUW: merge nieuwe data in plaats van alles te overschrijven
      if (result.extractedData) {
        setExtractedData((prev) => ({
          ...prev,
          ...result.extractedData,
        }));
      }

      setMicState("speaking");

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: result.botText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);

      await playAudioResponse(result.audioBase64);

      setMicState("idle");

      if (result.isFinished) {
        toast({
          title: "Intake afgerond",
          description: "Bedankt! We hebben uw gegevens ontvangen.",
          duration: 5000,
        });
      }
    } catch (error: any) {
      console.error("Error processing:", error);
      toast({
        title: "Foutmelding",
        description: error.message || "Er ging iets mis.",
        variant: "destructive",
      });
      setMicState("idle");
    }
  };

  const handleToggleRecording = async () => {
    if (micState === "recording") {
      try {
        const audioBlob = await audioRecorder.stopRecording();
        await handleProcessInput(audioBlob);
      } catch (error: any) {
        // Error handling...
        setMicState("idle");
      }
    } else {
      try {
        await audioRecorder.startRecording();
        setMicState("recording");
      } catch (error) {
        // Error handling...
      }
    }
  };

  // Tekst verzenden
  const handleSendText = async () => {
    if (!inputText.trim() || micState !== "idle") return;

    const textToSend = inputText;
    setInputText(""); // Veld leegmaken

    // Direct bericht tonen in chat
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    await handleProcessInput(textToSend);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-accent/20">
      <Card className="max-w-3xl w-full h-[85vh] flex flex-col shadow-[var(--shadow-card)]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-secondary/30">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Terug
          </Button>
          <h2 className="text-lg font-semibold">Intake Gesprek</h2>
          <Button variant="ghost" size="sm" className="gap-2" asChild>
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

        {/* Controls Area (Input + Mic) */}
        <div className="p-4 border-t bg-secondary/20 space-y-4">
          {/* Text Input Area */}
          <div className="flex gap-2 items-end">
            <Input
              placeholder="Typ uw antwoord..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyPress}
              className="flex-1 bg-background"
              disabled={micState !== "idle"}
            />
            <Button
              onClick={handleSendText}
              disabled={!inputText.trim() || micState !== "idle"}
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          {/* Microphone */}
          <div className="flex justify-center pb-2">
            <MicrophoneButton
              state={micState}
              onToggleRecording={handleToggleRecording}
            />
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Of bel voor persoonlijk contact:{" "}
              <a href="tel:+31201234567" className="underline">
                020-1234567
              </a>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
