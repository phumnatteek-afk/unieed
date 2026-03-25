import React, { useEffect, useState } from 'react';

const DonatePage = () => {
    const [formState, setFormState] = useState({
        donor_name: '',
        donateMethod: '',
        courier: '',
        trackingNo: '',
        appointDate: '',
        appointHour: '',
        appointMin: '',
        donorPhone: '',
    });

    const handleSaveDraft = () => {
        localStorage.setItem('donateDraft', JSON.stringify(formState));
    };

    const loadDraft = () => {
        const savedDraft = localStorage.getItem('donateDraft');
        if (savedDraft) {
            setFormState(JSON.parse(savedDraft));
        }
    };

    useEffect(() => {
        loadDraft();
    }, []);

    return (
        <div>
            <form>
                {/* Your form inputs here */}
                <div className="flex-container">
                    <button type="button" className="dnDraftBtn" onClick={handleSaveDraft}>บันทึกฉบับร่าง</button>
                    <button type="submit">Submit</button>
                </div>
            </form>
        </div>
    );
};

export default DonatePage;