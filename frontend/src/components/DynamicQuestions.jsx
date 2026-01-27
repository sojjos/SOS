import { useState, useEffect } from 'react';
import { HelpCircle, AlertCircle } from 'lucide-react';
import { dynamicQuestionsAPI } from '../services/api';
import clsx from 'clsx';

function DynamicQuestions({
  agencyId,
  ticketId,
  problemTypeId,
  urgency,
  blockingLevel,
  onResponsesChange,
  readOnly = false
}) {
  const [questions, setQuestions] = useState([]);
  const [responses, setResponses] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState({});

  // Charger les questions
  useEffect(() => {
    const loadQuestions = async () => {
      setIsLoading(true);
      try {
        let data;

        if (ticketId) {
          // Charger les questions avec les réponses existantes
          const response = await dynamicQuestionsAPI.getForTicket(ticketId);
          data = response.data;

          // Initialiser les réponses existantes
          const existingResponses = {};
          data.forEach(q => {
            if (q.response !== null) {
              existingResponses[q.id] = q.response;
            }
          });
          setResponses(existingResponses);
        } else if (agencyId) {
          // Charger les questions selon les critères
          const response = await dynamicQuestionsAPI.getForAgency(agencyId, {
            problem_type_id: problemTypeId,
            urgency,
            blocking_level: blockingLevel
          });
          data = response.data;
        }

        setQuestions(data || []);
      } catch (error) {
        console.error('Erreur chargement questions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (agencyId || ticketId) {
      loadQuestions();
    }
  }, [agencyId, ticketId, problemTypeId, urgency, blockingLevel]);

  // Notifier le parent des changements
  useEffect(() => {
    if (onResponsesChange) {
      const formattedResponses = Object.entries(responses).map(([questionId, value]) => ({
        question_id: questionId,
        value
      }));
      onResponsesChange(formattedResponses);
    }
  }, [responses, onResponsesChange]);

  const handleChange = (questionId, value) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));

    // Effacer l'erreur si elle existait
    if (errors[questionId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  const validateResponses = () => {
    const newErrors = {};

    questions.forEach(q => {
      if (q.is_required && (responses[q.id] === undefined || responses[q.id] === '')) {
        newErrors[q.id] = 'Ce champ est requis';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (questions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
        <HelpCircle className="w-5 h-5 text-primary-600" />
        Questions complémentaires
      </h3>

      {questions.map((question) => (
        <QuestionField
          key={question.id}
          question={question}
          value={responses[question.id]}
          onChange={(value) => handleChange(question.id, value)}
          error={errors[question.id]}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}

function QuestionField({ question, value, onChange, error, readOnly }) {
  const { question_type, question_text, options, is_required, help_text } = question;

  const renderInput = () => {
    switch (question_type) {
      case 'text':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={clsx('input', error && 'border-red-500')}
            rows={3}
            disabled={readOnly}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={clsx('input', error && 'border-red-500')}
            disabled={readOnly}
          />
        );

      case 'boolean':
        return (
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name={`question-${question.id}`}
                checked={value === true}
                onChange={() => onChange(true)}
                disabled={readOnly}
              />
              <span>Oui</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name={`question-${question.id}`}
                checked={value === false}
                onChange={() => onChange(false)}
                disabled={readOnly}
              />
              <span>Non</span>
            </label>
          </div>
        );

      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={clsx('input', error && 'border-red-500')}
            disabled={readOnly}
          >
            <option value="">Sélectionner...</option>
            {(options || []).map((opt, i) => (
              <option key={i} value={opt.value || opt}>
                {opt.label || opt}
              </option>
            ))}
          </select>
        );

      case 'multiselect':
        const selectedValues = value || [];
        return (
          <div className="space-y-2">
            {(options || []).map((opt, i) => {
              const optValue = opt.value || opt;
              const optLabel = opt.label || opt;
              const isChecked = selectedValues.includes(optValue);

              return (
                <label key={i} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onChange([...selectedValues, optValue]);
                      } else {
                        onChange(selectedValues.filter(v => v !== optValue));
                      }
                    }}
                    disabled={readOnly}
                  />
                  <span>{optLabel}</span>
                </label>
              );
            })}
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={clsx('input', error && 'border-red-500')}
            disabled={readOnly}
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      <label className="label">
        {question_text}
        {is_required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {help_text && (
        <p className="text-sm text-gray-500">{help_text}</p>
      )}

      {renderInput()}

      {error && (
        <p className="text-sm text-red-500 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
    </div>
  );
}

export default DynamicQuestions;
