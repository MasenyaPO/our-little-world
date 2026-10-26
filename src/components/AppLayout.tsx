import { NavLink } from 'react-router-dom';
import styles from './AppLayout.module.css';

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className={styles.layout}>
      <main className={styles.mainContent}>
        {children}
      </main>

      <nav className={styles.nav}>
        <NavLink to="/" className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
          <span className={styles.navIcon}>🌍</span>
          <span>Home</span>
        </NavLink>
        <NavLink to="/dates" className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
          <span className={styles.navIcon}>📅</span>
          <span>Dates</span>
        </NavLink>
        <NavLink to="/memories" className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
          <span className={styles.navIcon}>📸</span>
          <span>Memories</span>
        </NavLink>
        <NavLink to="/notes" className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
          <span className={styles.navIcon}>💌</span>
          <span>Notes</span>
        </NavLink>
        <NavLink to="/bucket-list" className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
          <span className={styles.navIcon}>✨</span>
          <span>Plans</span>
        </NavLink>
        <NavLink to="/questions" className={({isActive}) => isActive ? `${styles.navItem} ${styles.active}` : styles.navItem}>
          <span className={styles.navIcon}>🎲</span>
          <span>Q&A</span>
        </NavLink>
        
      </nav>
    </div>
  );
};