import React, { useRef, useState } from 'react';
import SignaturePad from 'react-signature-canvas';
import { Button } from "@/components/ui/button";
import { Trash2, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const SignatureCanvas = ({ onSave, width = 500, height = 200 }) => {
  const sigPad = useRef(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const clear = () => {
    sigPad.current.clear();
    setIsEmpty(true);
  };

  const handleEndDrawing = () => {
    setIsEmpty(sigPad.current.isEmpty());
  };

  const save = () => {
    if (sigPad.current.isEmpty()) {
      toast.error("Please provide a signature first.");
      return;
    }
    const signatureData = sigPad.current.getTrimmedCanvas().toDataURL('image/png');
    onSave(signatureData);
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-lg mx-auto">
      <div className="border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 overflow-hidden w-full relative group">
        <SignaturePad
          ref={sigPad}
          onEnd={handleEndDrawing}
          canvasProps={{
            width: width,
            height: height,
            className: "signature-canvas w-full h-full cursor-crosshair"
          }}
        />
        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
           <Button 
            type="button"
            variant="outline" 
            size="icon" 
            onClick={clear}
            className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-200"
            title="Clear signature"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
        
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-400 text-sm font-medium italic">Sign here with mouse or touch</p>
          </div>
        )}
      </div>

      <div className="flex w-full gap-3 justify-end">
        <Button 
          type="button"
          variant="outline" 
          onClick={clear}
          className="rounded-xl border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-2"
        >
          <Trash2 className="h-4 w-4" /> Clear All
        </Button>
        <Button 
          type="button"
          onClick={save}
          className="bg-[#185FA5] hover:bg-[#1451a0] text-white font-bold rounded-xl px-8 flex items-center gap-2 shadow-lg shadow-blue-100"
        >
          <Check className="h-4 w-4" /> Confirm Signature
        </Button>
      </div>
      
      <style jsx global>{`
        .signature-canvas {
          background-color: transparent;
          touch-action: none;
        }
      `}</style>
    </div>
  );
};

export default SignatureCanvas;
