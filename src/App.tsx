import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Mic,
  MicOff,
  Sun,
  Moon,
  PauseCircle,
  PlayCircle,
  Loader2,
  Power,
  Github,
  Linkedin,
} from "lucide-react";

function App() {
  // Estados relacionados con la IA y la grabación
  const [aiResponse, setAiResponse] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);

  // Referencias para manejar la síntesis de voz y la grabación
  const speechRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const GROQ_API_KEY =
    "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";

  // Verificar soporte de grabación de audio al montar el componente
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Lo siento, tu navegador no soporta la grabación de audio.");
    }
  }, []);

  // Toggle del modo oscuro/claro
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Aplicar el modo oscuro/claro al elemento raíz
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Función para iniciar la grabación de audio
  const startRecording = async () => {
    try {
      // Cancelar cualquier síntesis de voz en curso al iniciar una nueva grabación
      window.speechSynthesis.cancel();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/wav",
        });
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error al acceder al micrófono:", error);
      alert("No se pudo acceder al micrófono. Por favor, revisa los permisos.");
    }
  };

  // Función para detener la grabación de audio
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Toggle de grabación
  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Función para transcribir el audio grabado
  const transcribeAudio = async (audioBlob) => {
    setIsProcessing(true);
    setAiResponse("");

    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.wav");
      formData.append("model", "whisper-large-v3-turbo");

      const transcriptionResponse = await axios.post(
        "https://api.groq.com/openai/v1/audio/transcriptions",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
        }
      );

      const transcript = transcriptionResponse.data.text;
      console.log("Transcripción:", transcript);

      if (transcript.trim() !== "") {
        await sendToAI(transcript);
      }
    } catch (error) {
      console.error("Error al transcribir el audio:", error);
      alert("Hubo un error al transcribir el audio.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Función para enviar el mensaje transcrito a la IA
  const sendToAI = async (message) => {
    setIsProcessing(true);

    try {
      // Cancelar cualquier síntesis de voz en curso antes de enviar una nueva solicitud
      window.speechSynthesis.cancel();

      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: message }],
            model: "llama-3.2-90b-vision-preview",
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error de generación de respuesta:", errorData);
        throw new Error(
          `Error de generación de respuesta: ${response.status} - ${
            errorData.message || response.statusText
          }`
        );
      }

      const responseData = await response.json();
      const respuestaAI = responseData.choices[0].message.content;
      setAiResponse(respuestaAI);
    } catch (error) {
      console.error("Error al comunicarse con la API de Groq:", error);
      setAiResponse("");
      alert(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Función para pausar o reanudar la síntesis de voz
  const togglePause = () => {
    if (isSpeaking) {
      if (isPaused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsPaused(true);
      }
    }
  };

  // Cargar y filtrar las voces disponibles al montar el componente
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const spanishVoices = voices.filter(
        (voice) => voice.lang === "es-ES" || voice.lang === "es-MX"
      );
      setAvailableVoices(spanishVoices);

      // Establecer una voz predeterminada si no se ha seleccionado ninguna
      if (!selectedVoice && spanishVoices.length > 0) {
        setSelectedVoice(spanishVoices[0]);
      }
    };

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    loadVoices();
  }, [selectedVoice]);

  // Manejar la síntesis de voz cuando se recibe una respuesta de la IA
  useEffect(() => {
    if (aiResponse && selectedVoice) {
      window.speechSynthesis.cancel();

      const speech = new SpeechSynthesisUtterance(aiResponse);
      speech.lang = selectedVoice.lang;
      speech.voice = selectedVoice;
      speech.pitch = 1.0;
      speech.rate = 1.0;
      speechRef.current = speech;

      speech.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
      };

      speech.onend = () => {
        setIsSpeaking(false);
        setAiResponse(""); // Limpiar la respuesta para evitar repeticiones
      };

      speech.onerror = () => {
        setIsSpeaking(false);
        setIsPaused(false);
      };

      window.speechSynthesis.speak(speech);
    }
  }, [aiResponse, selectedVoice]);

  // Función para desconectar y reiniciar el estado de la aplicación
  const handleDisconnect = () => {
    // Detener la grabación si está en curso
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }

    // Cancelar cualquier síntesis de voz activa
    window.speechSynthesis.cancel();

    // Reiniciar todos los estados a sus valores iniciales
    setAiResponse("");
    setIsProcessing(false);
    setIsSpeaking(false);
    setIsPaused(false);
    setSelectedVoice(null);

    alert("Desconectado. La aplicación ha sido reiniciada.");
  };

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-300 ${
        isDarkMode ? "bg-gray-900" : "bg-green-100"
      }`}
    >
      {/* Sección del Modo Oscuro/Claro */}
      <div className="mb-4 text-center">
        <div className="mt-4 flex justify-center">
          <button
            onClick={toggleDarkMode}
            className="flex items-center space-x-2 justify-center focus:outline-none bg-green-200 dark:bg-gray-700 hover:bg-green-300 dark:hover:bg-gray-600 transition-colors duration-300 px-4 py-2 rounded-full shadow-md"
            aria-label="Alternar Modo Oscuro"
          >
            {isDarkMode ? (
              <>
                <Sun className="w-6 h-6 text-yellow-400" />
                <span className="text-gray-700 dark:text-gray-300">
                  Modo Claro
                </span>
              </>
            ) : (
              <>
                <Moon className="w-6 h-6 text-gray-600" />
                <span className="text-white dark:text-gray-300">
                  Modo Oscuro
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tarjeta Principal */}
      <div
        className={`w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 transition-colors duration-300 ${
          isDarkMode ? "" : "bg-green-200"
        }`}
      >
        {/* Selección de Voz */}
        <div className="flex justify-between mb-6">
          <div className="w-full">
            <label
              htmlFor="voice-select"
              className="block text-gray-700 dark:text-gray-300 mb-2 text-sm font-medium"
            >
              Selecciona la Voz:
            </label>
            <div className="relative">
              <select
                id="voice-select"
                value={selectedVoice ? selectedVoice.name : ""}
                onChange={(e) => {
                  const voice = availableVoices.find(
                    (v) => v.name === e.target.value
                  );
                  setSelectedVoice(voice);
                }}
                className="w-full appearance-none bg-green-200 dark:bg-gray-700 border border-green-300 dark:border-gray-600 text-white dark:text-white py-2 px-4 pr-10 rounded-lg leading-tight focus:outline-none focus:ring-2 focus:ring-green-500 shadow-sm transition-colors duration-300"
              >
                {availableVoices.map((voice, index) => (
                  <option
                    key={index}
                    value={voice.name}
                    className="text-white bg-green-200 dark:bg-gray-700"
                  >
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                <svg
                  className="fill-current h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path d="M5.516 7.548a.75.75 0 10-1.032 1.098l5 6a.75.75 0 001.032 0l5-6a.75.75 0 10-1.032-1.098L10 12.33 5.516 7.548z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Indicadores de Procesamiento y Síntesis */}
        <div className="flex flex-col items-center mb-6 space-y-4">
          {(isProcessing || isSpeaking) && (
            <div className="flex items-center space-x-2">
              <Loader2
                className={`animate-spin w-6 h-6 ${
                  isProcessing
                    ? "text-blue-500"
                    : isSpeaking
                    ? "text-green-500"
                    : "text-gray-500"
                }`}
              />
              <span className="text-gray-700 dark:text-gray-300 text-sm">
                {isProcessing
                  ? "Procesando..."
                  : isSpeaking
                  ? "Respondiendo..."
                  : ""}
              </span>
            </div>
          )}
        </div>

        {/* Controles de Grabación y Pausa */}
        <div className="flex flex-col items-center space-y-4">
          {/* Botón de Grabación */}
          <button
            onClick={toggleRecording}
            className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-colors duration-300 ${
              isRecording
                ? "bg-red-500 hover:bg-red-600"
                : "bg-green-500 hover:bg-green-600"
            } text-white focus:outline-none shadow-md`}
            aria-label={isRecording ? "Detener grabación" : "Comenzar a hablar"}
          >
            {isRecording ? (
              <>
                <Mic className="w-6 h-6 animate-pulse" />
                <span>Grabando...</span>
              </>
            ) : (
              <>
                <MicOff className="w-6 h-6" />
                <span>Hablar</span>
              </>
            )}
          </button>

          {/* Botón de Pausa/Reproducción */}
          {isSpeaking && (
            <button
              onClick={togglePause}
              className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-colors duration-300 ${
                isPaused
                  ? "bg-yellow-500 hover:bg-yellow-600"
                  : "bg-blue-500 hover:bg-blue-600"
              } text-white focus:outline-none shadow-md`}
              aria-label={
                isPaused ? "Reproducir respuesta" : "Pausar respuesta"
              }
            >
              {isPaused ? (
                <PlayCircle className="w-6 h-6" />
              ) : (
                <PauseCircle className="w-6 h-6" />
              )}
              <span>{isPaused ? "Reproducir" : "Pausar"}</span>
            </button>
          )}
        </div>

        {/* Botón de Desconexión */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleDisconnect}
            className="flex items-center space-x-2 px-4 py-2 rounded-full transition-colors duration-300 bg-gray-500 hover:bg-gray-600 text-white focus:outline-none shadow-md"
            aria-label="Desconectar"
          >
            <Power className="w-6 h-6" />
            <span>Desconectar</span>
          </button>
        </div>

        {/* Instrucciones */}
        <div className="mt-8">
          <h2 className="text-center text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Instrucciones
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm">
            Para comenzar a hablar, presiona el botón "Hablar". Cuando termines,
            presiona el botón "Escuchando". La IA procesará tu solicitud y
            responderá automáticamente. Si necesitas pausar la respuesta,
            utiliza el botón "Pausa".
          </p>
        </div>

        {/* Detalles de los Modelos Utilizados */}
        <div className="mt-6">
          <p className="text-center text-gray-500 dark:text-gray-400 text-xs">
            <strong>Modelos Utilizados:</strong> Groq -{" "}
            <em>whisper-large-v3-turbo</em> para transcripción y{" "}
            <em>llama-3.2-90b-vision-preview</em> para respuestas.
          </p>
        </div>
      </div>

      {/* Sección de Créditos y Enlaces Sociales */}
      <div className="mt-12 mb-8">
        {" "}
        {/* Mayor margen superior */}
        <p className="text-gray-700 dark:text-gray-300">
          Creado por{" "}
          <span
            className={`px-2 py-1 rounded ${
              isDarkMode ? "bg-black text-white" : "bg-green-200 text-gray-800"
            }`}
          >
            Johan Morales
          </span>
        </p>
        {/* Iconos de Github y LinkedIn */}
        <div className="flex space-x-4 mt-2 justify-center">
          <a
            href="https://github.com/JohanMorales211"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors duration-300"
          >
            <Github className="w-6 h-6" />
          </a>
          <a
            href="https://www.linkedin.com/in/johan-morales-b3809b206/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors duration-300"
          >
            <Linkedin className="w-6 h-6" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default App;
