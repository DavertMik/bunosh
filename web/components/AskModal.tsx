import React from 'react';

export const AskModal = ({ prompt, response, setResponse, onSubmit, askOptions = {} }) => {
  const neoBrutalButton = "px-4 py-2 font-medium border-2 border-gray-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all";

  // Determine input type based on options
  const getInputType = () => {
    // Check if it's a boolean/confirm
    if (typeof askOptions.defaultValue === 'boolean') {
      return 'confirm';
    }
    // Check if it has choices
    if (askOptions.options?.choices || Array.isArray(askOptions.defaultValue)) {
      return 'choices';
    }
    // Check if it's multiline
    if (askOptions.options?.multiline || askOptions.options?.editor) {
      return 'multiline';
    }
    // Default to text input
    return 'text';
  };

  const inputType = getInputType();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputType === 'confirm') {
      onSubmit(true); // For confirm, always submit true
    } else if (response.trim()) {
      onSubmit();
    }
  };

  const handleChoiceSelect = (choice) => {
    setResponse(choice);
    onSubmit();
  };

  const renderInput = () => {
    switch (inputType) {
      case 'confirm':
        return (
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <button
              type="button"
              onClick={() => { setResponse('false'); onSubmit(); }}
              style={{
                padding: '0.75rem 2rem',
                fontWeight: '600',
                border: '2px solid #374151',
                boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
                backgroundColor: '#374151',
                color: '#e0e0e0',
                fontFamily: 'Courier New, monospace',
                cursor: 'pointer'
              }}
            >
              NO
            </button>
            <button
              type="button"
              onClick={() => { setResponse('true'); onSubmit(); }}
              style={{
                padding: '0.75rem 2rem',
                fontWeight: '600',
                border: '2px solid #000000',
                boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
                backgroundColor: '#FFB400',
                color: '#000000',
                fontFamily: 'Courier New, monospace',
                cursor: 'pointer'
              }}
            >
              YES
            </button>
          </div>
        );

      case 'choices':
        const choices = askOptions.options?.choices || askOptions.defaultValue || [];
        return (
          <div style={{ marginBottom: '1.5rem' }}>
            {choices.map((choice, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleChoiceSelect(choice)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                  border: '2px solid #2a2a2a',
                  boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
                  backgroundColor: '#1a1a1a',
                  color: '#e0e0e0',
                  fontFamily: 'Courier New, monospace',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                {choice}
              </button>
            ))}
          </div>
        );

      case 'multiline':
        return (
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Enter your response (multiline)..."
            autoFocus
            rows={5}
            style={{
              width: '100%',
              padding: '0.875rem',
              backgroundColor: '#0a0a0a',
              border: '3px solid #2a2a2a',
              color: '#e0e0e0',
              fontSize: '1rem',
              fontFamily: 'Courier New, monospace',
              outline: 'none',
              marginBottom: '1.5rem',
              boxShadow: '2px 2px 0px 0px rgba(42,42,42,0.5)',
              resize: 'vertical'
            }}
          />
        );

      default:
        return (
          <input
            type="text"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Enter your response..."
            autoFocus
            style={{
              width: '100%',
              padding: '0.875rem',
              backgroundColor: '#0a0a0a',
              border: '3px solid #2a2a2a',
              color: '#e0e0e0',
              fontSize: '1rem',
              fontFamily: 'Courier New, monospace',
              outline: 'none',
              marginBottom: '1.5rem',
              boxShadow: '2px 2px 0px 0px rgba(42,42,42,0.5)'
            }}
          />
        );
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        border: '4px solid #FFB400',
        borderRadius: '0.5rem',
        padding: '2rem',
        width: '90%',
        maxWidth: '500px',
        boxShadow: '8px 8px 0px 0px rgba(255,180,0,0.3)'
      }}>
        <div style={{
          fontSize: '1.25rem',
          fontWeight: '700',
          color: '#FFB400',
          marginBottom: '1rem',
          fontFamily: 'Courier New, monospace'
        }}>
          🤔 Input Required
        </div>

        <div style={{
          fontSize: '1rem',
          color: '#e0e0e0',
          marginBottom: '1.5rem'
        }}>
          {prompt}
        </div>

        {inputType !== 'confirm' && inputType !== 'choices' ? (
        <form onSubmit={handleSubmit}>
          {renderInput()}

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setResponse('');
                onSubmit();
              }}
              className={neoBrutalButton}
              style={{
                backgroundColor: '#3a3a3a',
                color: '#e0e0e0',
                borderColor: '#2a2a2a'
              }}
            >
              CANCEL
            </button>
            <button
              type="submit"
              className={neoBrutalButton}
              style={{
                backgroundColor: '#FFB400',
                color: '#000',
                borderColor: '#1a1a1a',
                fontWeight: '700'
              }}
            >
              SUBMIT
            </button>
          </div>
        </form>
      ) : (
        renderInput()
      )}
      </div>
    </div>
  );
};