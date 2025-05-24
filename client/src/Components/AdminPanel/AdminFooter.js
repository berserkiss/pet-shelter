import React from 'react';
import './AdminFooter.css';

function AdminFooter() {
  return (
    <footer className="admin-footer">
      <p>&copy; {new Date().getFullYear()} PawFinds Администрирование. Все права защищены.</p>
    </footer>
  );
}

export default AdminFooter;
